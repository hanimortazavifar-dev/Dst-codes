import { useState, type InputHTMLAttributes } from "react";
import { EyeIcon, EyeOffIcon } from "./icons";
import styles from "./PasswordInput.module.css";

/** Password field with an eye button (at the left end in RTL) that shows or hides the text. */
export default function PasswordInput({ className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={styles.wrap}>
      <input {...props} className={`${className ?? ""} ${styles.input}`} type={visible ? "text" : "password"} />
      <button
        type="button"
        className={styles.eye}
        aria-label={visible ? "پنهان کردن رمز" : "نمایش رمز"}
        aria-pressed={visible}
        title={visible ? "پنهان کردن رمز" : "نمایش رمز"}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}
