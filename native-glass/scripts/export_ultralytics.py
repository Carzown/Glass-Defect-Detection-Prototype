import sys
from pathlib import Path

def main():
    try:
        from ultralytics import YOLO
    except Exception as e:
        print(f"ERROR: ultralytics not installed: {e}")
        sys.exit(2)

    if len(sys.argv) < 2:
        print("Usage: python scripts/export_ultralytics.py <model_path> [imgsz=640] [project=exports] [name=yv11_torchscript]")
        sys.exit(1)

    model_path = Path(sys.argv[1]).as_posix()
    imgsz = int(sys.argv[2]) if len(sys.argv) > 2 else 640
    project = sys.argv[3] if len(sys.argv) > 3 else 'exports'
    name = sys.argv[4] if len(sys.argv) > 4 else 'yv11_torchscript'

    yolo = YOLO(model_path)
    result = yolo.export(format='torchscript', imgsz=imgsz, project=project, name=name)
    print(result)

if __name__ == '__main__':
    main()
