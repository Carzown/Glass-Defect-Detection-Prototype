import tkinter as tk
from tkinter import ttk
import threading
import queue
import subprocess
import signal
import sys
import os
import tempfile
from datetime import datetime

try:
    from PIL import Image, ImageTk
    PILLOW_AVAILABLE = True
except ImportError:
    PILLOW_AVAILABLE = False

FRAME_PATH = os.path.join(tempfile.gettempdir(), "gdd_latest_frame.jpg")

# ── Supabase device_status sync ───────────────────────────────────────────
# Same config import pattern as MainDetection.py
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'modules'))

try:
    from config import DEVICE_ID, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
except ImportError as e:
    print(f'[TkinterApp] ERROR: Failed to import config: {e}')
    DEVICE_ID = 'raspi-pi-1'
    SUPABASE_URL = None
    SUPABASE_SERVICE_ROLE_KEY = None

_supabase = None
try:
    from supabase import create_client as _create_client
    if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
        _supabase = _create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        print(f'[TkinterApp] Supabase connected (device: {DEVICE_ID})')
    else:
        print('[TkinterApp] WARNING: Supabase credentials missing in config.py')
except Exception as _e:
    print(f'[TkinterApp] Supabase init failed: {_e}')


def _set_device_online(online: bool):
    """Upsert device_status row in a background thread so the UI never blocks."""
    if not _supabase:
        return
    def _do():
        try:
            _supabase.table('device_status').upsert({
                'device_id': DEVICE_ID,
                'is_online': online,
                'last_seen': datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S+00:00'),
            }, on_conflict='device_id').execute()
        except Exception as e:
            print(f'[TkinterApp] device_status upsert failed: {e}')
    threading.Thread(target=_do, daemon=True).start()

class DefectDetectorApp:
    def __init__(self, root):

        self.root = root
        self.root.title("Glass Defect Detector")
        self.root.attributes("-fullscreen", True)
        self.root.configure(bg="#0f2942")
        
        # allow escape for debug
        self.root.bind("<Escape>", lambda e: self.root.attributes("-fullscreen", False))
        self.root.bind("<F1>", lambda e: self.root.attributes("-fullscreen", True))
        self.is_running = False
        self.output_queue = queue.Queue()
        self.process = None
        self._photo = None
        self.defect_count = 0

        self.start_color = "#28a745"
        self.start_hover = "#34c759"

        self.stop_color = "#dc3545"
        self.stop_hover = "#ff5c5c"

        self.setup_ui()
        self.check_output_queue()

        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)

        # Mark device offline on startup (clean slate)
        _set_device_online(False)

    def setup_ui(self):

        header_frame = tk.Frame(self.root, bg="#0f2942", height=80)
        header_frame.pack(fill=tk.X, padx=20, pady=10)
        header_frame.pack_propagate(False)

        title_label = tk.Label(
            header_frame,
            text="Glass Defect Detector",
            font=("Arial", 28, "bold"),
            bg="#0f2942",
            fg="white"
        )
        title_label.pack(side=tk.LEFT, pady=10)

        self.control_button = tk.Button(
            header_frame,
            text="Start Detection",
            font=("Arial", 12, "bold"),
            bg=self.start_color,
            fg="white",
            padx=20,
            pady=10,
            command=self.toggle_detection,
            cursor="hand2",
            relief=tk.RAISED,
            bd=3
        )

        self.control_button.pack(side=tk.RIGHT, padx=10)

        self.control_button.bind("<Enter>", self.on_button_hover)
        self.control_button.bind("<Leave>", self.on_button_leave)

        content_frame = tk.Frame(self.root, bg="#0f2942")
        content_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=10)

        preview_frame = tk.Frame(content_frame, bg="#0f2942", relief=tk.RIDGE, bd=2)
        preview_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 5))

        preview_title = tk.Label(
            preview_frame,
            text="Live Detection",
            font=("Arial", 14, "bold"),
            bg="#0f2942",
            fg="white",
            pady=10
        )
        preview_title.pack()

        self.preview_canvas = tk.Canvas(
            preview_frame,
            bg="#1a1a1a",
            highlightthickness=0
        )

        self.preview_canvas.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        self.placeholder_id = self.preview_canvas.create_text(
            400,
            300,
            text="Start detection to see live feed",
            font=("Arial", 14),
            fill="#666666",
            tags="placeholder"
        )

        RIGHT_PANEL_WIDTH = 420

        defect_frame = tk.Frame(content_frame, bg="#0f2942", relief=tk.RIDGE, bd=2)
        defect_frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=False, padx=(5, 0))
        defect_frame.pack_propagate(False)
        defect_frame.configure(width=RIGHT_PANEL_WIDTH)

        tk.Label(
            defect_frame,
            text="Detected Defects",
            font=("Arial", 14, "bold"),
            bg="#0f2942",
            fg="white",
            pady=10
        ).pack()

        tree_container = tk.Frame(defect_frame, bg="#0f2942")
        tree_container.pack(fill=tk.BOTH, expand=True, padx=10, pady=(0, 5))

        style = ttk.Style()
        style.theme_use("default")

        style.configure(
            "Defects.Treeview",
            background="#f8fafb",
            foreground="#0f2942",
            fieldbackground="#f8fafb",
            rowheight=28,
            font=("Courier", 10)
        )

        style.configure(
            "Defects.Treeview.Heading",
            background="#f0c36d",
            foreground="#0f2942",
            font=("Arial", 10, "bold")
        )

        style.map(
            "Defects.Treeview",
            background=[("selected", "#f0c36d")]
        )

        self.defect_tree = ttk.Treeview(
            tree_container,
            columns=("num", "defects", "time"),
            show="headings",
            style="Defects.Treeview"
        )

        self.defect_tree.heading("num", text="#")
        self.defect_tree.heading("defects", text="Defects")
        self.defect_tree.heading("time", text="Time")

        self.defect_tree.column("num", width=35, anchor="center", stretch=False)
        self.defect_tree.column("defects", width=160, anchor="w")
        self.defect_tree.column("time", width=75, anchor="center", stretch=False)

        scrollbar = ttk.Scrollbar(tree_container, orient=tk.VERTICAL,
                                  command=self.defect_tree.yview)

        self.defect_tree.configure(yscrollcommand=scrollbar.set)

        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.defect_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        footer = tk.Frame(defect_frame, bg="#0f2942")
        footer.pack(fill=tk.X, padx=10, pady=(0, 10))

        self.total_label = tk.Label(
            footer,
            text="Total: 0 detections",
            font=("Arial", 10, "bold"),
            bg="#0f2942",
            fg="#f0c36d"
        )

        self.total_label.pack(side=tk.LEFT)

    def on_button_hover(self, event):
        if self.is_running:
            self.control_button.config(bg=self.stop_hover)
        else:
            self.control_button.config(bg=self.start_hover)

    def on_button_leave(self, event):
        if self.is_running:
            self.control_button.config(bg=self.stop_color)
        else:
            self.control_button.config(bg=self.start_color)

    def toggle_detection(self):
        if self.is_running:
            self.stop_detection()
        else:
            self.start_detection()

    def start_detection(self):

        self.is_running = True

        self.control_button.config(
            text="Stop Detection",
            bg=self.stop_color,
            fg="white"
        )

        self.preview_canvas.delete("placeholder")

        self.defect_tree.delete(*self.defect_tree.get_children())
        self.defect_count = 0

        self.total_label.config(text="Total: 0 detections")

        # Mark device online and start heartbeat
        _set_device_online(True)
        self._heartbeat()

        script_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "MainDetection.py"
        )

        env = os.environ.copy()
        env["ENABLE_DISPLAY"] = "false"
        env["PYTHONUNBUFFERED"] = "1"

        self.process = subprocess.Popen(
            [sys.executable, script_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            env=env
        )

        threading.Thread(target=self._read_stdout, daemon=True).start()

        if PILLOW_AVAILABLE:
            self._poll_frame()

    def stop_detection(self):

        self.is_running = False

        self.control_button.config(
            text="Start Detection",
            bg=self.start_color,
            fg="white"
        )

        # Mark device offline
        _set_device_online(False)

        self.preview_canvas.delete("all")

        w = self.preview_canvas.winfo_width() or 900
        h = self.preview_canvas.winfo_height() or 550

        self.preview_canvas.create_rectangle(
            0, 0, w, h,
            fill="black",
            outline="black"
        )

        if self.process:

            proc = self.process
            self.process = None

            def _shutdown(p):
                try:
                    p.send_signal(signal.SIGINT)
                    p.wait(timeout=5)
                except Exception:
                    p.terminate()

            threading.Thread(target=_shutdown, args=(proc,), daemon=True).start()

    def on_closing(self):

        _set_device_online(False)
        if self.is_running:
            self.stop_detection()

        self.root.destroy()

    def _heartbeat(self):
        """Refresh last_seen every 30 s while running so the frontend
        can treat a stale timestamp as an implicit offline signal."""
        if not self.is_running:
            return
        _set_device_online(True)
        self.root.after(30_000, self._heartbeat)

    def _read_stdout(self):

        proc = self.process

        for line in proc.stdout:
            self.output_queue.put(line)

        self.output_queue.put("[Process ended]\n")

    def _poll_frame(self):

        if not self.is_running:
            return

        if os.path.exists(FRAME_PATH):

            try:

                img = Image.open(FRAME_PATH)
                img = img.copy()

                canvas_w = self.preview_canvas.winfo_width() or 900
                canvas_h = self.preview_canvas.winfo_height() or 550

                img_w, img_h = img.size

                scale = min(canvas_w / img_w, canvas_h / img_h)

                new_w = int(img_w * scale)
                new_h = int(img_h * scale)

                img = img.resize((new_w, new_h), Image.LANCZOS)

                self._photo = ImageTk.PhotoImage(img)

                self.preview_canvas.delete("frame")

                x = (canvas_w - new_w) // 2
                y = (canvas_h - new_h) // 2

                self.preview_canvas.create_image(
                    x,
                    y,
                    anchor=tk.NW,
                    image=self._photo,
                    tags="frame"
                )

            except Exception:
                pass

        self.root.after(1, self._poll_frame)

    def check_output_queue(self):

        try:
            while True:

                line = self.output_queue.get_nowait().strip()

                if line.startswith("Saved to DB:"):

                    raw = line.replace("Saved to DB:", "").strip()

                    seen = set()
                    unique = []

                    for t in raw.split(","):

                        t = t.strip()

                        if t and t.lower() not in seen:
                            seen.add(t.lower())
                            unique.append(t.capitalize())

                    self._add_defect_row(", ".join(unique))

        except queue.Empty:
            pass

        self.root.after(100, self.check_output_queue)

    def _add_defect_row(self, defects_label):

        self.defect_count += 1

        timestamp = datetime.now().strftime("%H:%M:%S")

        self.defect_tree.insert(
            "",
            tk.END,
            values=(self.defect_count, defects_label, timestamp)
        )

        children = self.defect_tree.get_children()

        if children:
            self.defect_tree.see(children[-1])

        self.total_label.config(
            text=f"Total: {self.defect_count} detection{'s' if self.defect_count != 1 else ''}"
        )


def main():

    root = tk.Tk()

    app = DefectDetectorApp(root)

    root.mainloop()


if __name__ == "__main__":
    main()
