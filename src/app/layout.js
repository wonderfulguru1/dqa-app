import "./globals.css";

export const metadata = {
  title: "ECEWS DQA Companion",
  description: "Data Quality Assessment tool for ECEWS field and HQ teams",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
