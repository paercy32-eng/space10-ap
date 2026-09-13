import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import Space10App from "./Space10App";
import AdminDashboard from "./AdminDashboard";

// No router dependency for just two routes: "/admin" loads the standalone
// admin dashboard page; everything else loads the main app (which has its
// own built-in admin console reachable by simply logging in with an admin
// account -- /admin is an alternate, dedicated admin-only URL for
// convenience, not the only way to reach admin features).
const isAdminRoute = window.location.pathname.replace(/\/+$/, "") === "/admin";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>{isAdminRoute ? <AdminDashboard /> : <Space10App />}</React.StrictMode>
);
