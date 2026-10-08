# Python 10 — trình chạy code của học sinh (dùng chung cho web/Pyodide và bộ kiểm tra/CPython).
# _chay(code, inputs, seed) -> dict(out, err)
#   inputs: danh sách các dòng nhập; input() in câu dẫn rồi in lại giá trị đã nhập + xuống dòng (giống terminal VS Code)
#   err: None hoặc dict(type, msg, line, tb) — tb là traceback chỉ gồm các dòng của main.py
import builtins
import io
import random
import sys
import traceback

_HET_NHAP = "__HET_NHAP__"


def _tb_text(e, dong_code=()):
    if isinstance(e, SyntaxError):
        return "".join(traceback.format_exception_only(type(e), e)).rstrip("\n")
    frames = [f for f in traceback.extract_tb(e.__traceback__) if f.filename == "main.py"]
    dong = ["Traceback (most recent call last):"]
    for f in frames:
        dong.append('  File "main.py", line %d, in %s' % (f.lineno, f.name))
        line = f.line or (dong_code[f.lineno - 1] if 0 < f.lineno <= len(dong_code) else "")
        if line and line.strip():
            dong.append("    " + line.strip())
    dong.append("".join(traceback.format_exception_only(type(e), e)).rstrip("\n"))
    return "\n".join(dong)


def _chay(code, inputs=(), seed=None):
    out = io.StringIO()
    hang = [str(x) for x in inputs]

    def _input(prompt=""):
        out.write(str(prompt))
        if not hang:
            raise EOFError(_HET_NHAP)
        v = hang.pop(0)
        out.write(v + "\n")
        return v

    g = {"__name__": "__main__", "__builtins__": builtins}
    cu_out, cu_in = sys.stdout, builtins.input
    sys.stdout, builtins.input = out, _input
    if seed is not None:
        random.seed(seed)
    err = None
    try:
        exec(compile(code, "main.py", "exec"), g)
    except SystemExit:
        pass
    except SyntaxError as e:
        err = dict(type=type(e).__name__, msg=str(e.msg), line=int(e.lineno or 0), tb=_tb_text(e))
    except BaseException as e:  # noqa: BLE001 — báo mọi lỗi của học sinh
        frames = [f for f in traceback.extract_tb(e.__traceback__) if f.filename == "main.py"]
        msg = str(e)
        err = dict(type=type(e).__name__, msg=msg, line=int(frames[-1].lineno) if frames else 0, tb=_tb_text(e, code.splitlines()))
        if isinstance(e, EOFError) and msg == _HET_NHAP:
            err = dict(type="HetNhap", msg="", line=err["line"], tb="")
    finally:
        sys.stdout, builtins.input = cu_out, cu_in
    return dict(out=out.getvalue(), err=err)


if __name__ == "__main__" and sys.platform != "emscripten":
    # Bộ kiểm tra gọi: python runner.py < {"code":..., "inputs":[...], "seed":...}  -> JSON
    import json
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    d = json.loads(sys.stdin.read())
    if isinstance(d, list):          # nhiều lần chạy một lượt
        print(json.dumps([_chay(x["code"], x.get("inputs", []), x.get("seed")) for x in d], ensure_ascii=False))
    else:
        print(json.dumps(_chay(d["code"], d.get("inputs", []), d.get("seed")), ensure_ascii=False))
