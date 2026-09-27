import { Geist, Geist_Mono, Jua } from "next/font/google";
import "./globals.css";
import AppFrame from "@/components/AppFrame";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/*
  책 이름에만 쓰는 둥근 글꼴. (Google Fonts — 무료)
  본문까지 이 글꼴로 두면 긴 설명이 읽기 불편해진다.
  한글 자형은 용량이 커서 preload를 끄고 필요할 때 받게 한다.
*/
const jua = Jua({
  weight: "400",
  variable: "--font-jua",
  display: "swap",
  preload: false,
});

export const metadata = {
  title: "나의 책장",
  description: "읽은 책과 좋아한 구절을 모아두는 나만의 서재",

  // 홈 화면에 추가했을 때 아이콘 아래 붙는 이름.
  // 길면 iOS가 가운데를 잘라내므로 짧게 둔다.
  appleWebApp: {
    title: "책장",
    // 주소창 없이 앱처럼 열린다. 아이폰 Safari는 저장소를 잘 지우는데(ITP),
    // 홈 화면에서 자주 열면 덜 지워진다.
    capable: true,
    statusBarStyle: "default",
  },
};

// 휴대폰에서 화면 폭에 맞춰 보이게 한다. Design Ref: §1.2 "380px가 기준"
export const viewport = {
  width: "device-width",
  initialScale: 1,
  // 주소창·상태바 색. 화면 바닥과 같은 미색이라야 이어져 보인다.
  // 기기 설정과 상관없이 한 색이다 — globals.css도 한 벌로 두었다.
  themeColor: "#f8f3e9",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} ${jua.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AppFrame>{children}</AppFrame>
      </body>
    </html>
  );
}
