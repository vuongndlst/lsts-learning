/* Python 10 — Web Worker (module) chạy Python bằng Pyodide.
   Chạy trong worker để trang không bị treo; vòng lặp vô hạn thì trang chính huỷ worker và tạo lại. */
import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pyodide.mjs";

const ready = (async () => {
  const py = await loadPyodide();
  const src = await (await fetch(new URL("runner.py", import.meta.url), { cache: "no-cache" })).text();
  py.runPython(src);
  const ver = py.runPython("import sys; '%d.%d' % sys.version_info[:2]");
  return { py, chay: py.globals.get("_chay"), ver };
})();

ready.then(r => postMessage({ kind: "ready", ver: r.ver }))
  .catch(e => postMessage({ kind: "fail", error: String(e && e.message || e) }));

onmessage = async e => {
  const { id, code, inputs, seed } = e.data;
  try {
    const { py, chay } = await ready;
    const res = chay(code, py.toPy(inputs || []), seed == null ? undefined : seed);
    const obj = res.toJs({ dict_converter: Object.fromEntries });
    res.destroy();
    postMessage({ kind: "result", id, out: obj.out, err: obj.err || null });
  } catch (err) {
    postMessage({ kind: "result", id, out: "", err: { type: "WebError", msg: String(err && err.message || err), line: 0, tb: "" } });
  }
};
