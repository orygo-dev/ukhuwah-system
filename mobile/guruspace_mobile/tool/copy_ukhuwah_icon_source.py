from pathlib import Path
import shutil

src = Path(r"C:\Users\Baenk's\.cursor\projects\c-Users-Baenk-s-Documents-Script-UKHUWAH-SYSTEM\assets") / (
    "c__Users_Baenk_s_AppData_Roaming_Cursor_User_workspaceStorage_"
    "1d93b21e17cb0407337af4291841dc4f_images_ChatGPT_Image_Sep_4__2026__05_14_22_PM-82b8e86c-f50a-401b-b8e9-6426436e8c85.jpg"
)
dest = Path(__file__).resolve().parents[1] / "assets" / "branding" / "ukhuwah_mobile_icon_source.jpg"
dest.parent.mkdir(parents=True, exist_ok=True)
if not src.exists():
    raise SystemExit(f"source missing: {src}")
shutil.copyfile(src, dest)
print(f"copied {src} -> {dest} ({dest.stat().st_size} bytes)")
