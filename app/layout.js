import "./globals.css";

export const metadata = {
  title: "Local Pro 1",
  description: "Local Pro 1 Business Management Platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}