import { Link } from "react-router-dom";
import { ArrowIcon } from "../components/icons";
import { ROUTES } from "../routes";
import slate from "../styles/slate.module.css";

export default function NotFound() {
  return (
    <div className={slate.page} dir="rtl" lang="fa">
      <div className={slate.header} style={{ maxWidth: 520, margin: "12vh auto 0" }}>
        <h1>صفحه پیدا نشد (۴۰۴)</h1>
        <p>آدرسی که وارد کرده‌اید وجود ندارد یا جابه‌جا شده است.</p>
        <p style={{ marginTop: 16 }}>
          <Link className={slate.back} to={ROUTES.home} style={{ color: "inherit", opacity: 0.8 }}>
            <ArrowIcon />
            بازگشت به صفحه اصلی
          </Link>
        </p>
      </div>
    </div>
  );
}
