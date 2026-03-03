import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0A0A0F",
        padding: "24px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 400 }}>{children}</div>
    </div>
  );
}
