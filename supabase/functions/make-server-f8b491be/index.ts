// Deploy shim: the real app lives in ../server (folder name != legacy deployed slug).
// The client calls /functions/v1/make-server-f8b491be/..., so the function must
// keep this slug; CLI derives slug from folder name, hence this one-line shim.
import "../server/index.tsx";
