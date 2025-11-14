import argparse
import os
import sys

def main():
    parser = argparse.ArgumentParser(description="Verify and convert a TorchScript model to Mobile Lite (.ptl)")
    parser.add_argument("input", help="Path to a .pt or .ptl file")
    parser.add_argument("--out", dest="out", default=None, help="Output path for .ptl (defaults to <input>.ptl)")
    args = parser.parse_args()

    in_path = os.path.abspath(args.input)
    out_path = os.path.abspath(args.out) if args.out else in_path + ".ptl"

    try:
        import torch
        from torch.utils.mobile_optimizer import optimize_for_mobile
    except Exception as e:
        print("ERROR: PyTorch is not installed. Install it with 'pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121' (or cpu).", file=sys.stderr)
        sys.exit(2)

    if not os.path.exists(in_path):
        print(f"ERROR: Input file not found: {in_path}", file=sys.stderr)
        sys.exit(1)

    # Try to load as TorchScript directly
    try:
        scripted = torch.jit.load(in_path, map_location="cpu")
        print("OK: File is TorchScript (jit.load succeeded)")
    except Exception as e:
        print("NOT TORCHSCRIPT: torch.jit.load failed.\n" 
              "If this is an Ultralytics YOLO model, export first:\n"
              "  pip install ultralytics\n"
              "  yolo export model=<your .pt> format=torchscript imgsz=640\n"
              "Then re-run this script on the exported torchscript .pt file.")
        sys.exit(3)

    try:
        scripted.eval()
        mobile = optimize_for_mobile(scripted)
        # Save as mobile lite interpreter
        torch.jit.save(mobile, out_path)
        print(f"SAVED: Mobile TorchScript written to {out_path}")
        sys.exit(0)
    except Exception as e:
        print(f"ERROR: optimize_for_mobile or save failed: {e}", file=sys.stderr)
        sys.exit(4)

if __name__ == "__main__":
    main()
