import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "메인",
};

export default function HomePage() {
  return <div aria-label="메인 화면" />;
}
