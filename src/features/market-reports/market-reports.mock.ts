import type { MarketReportsData } from "./market-reports.types";

export const marketReportsMock: MarketReportsData = {
  kpis: [
    { label: "Bao cao", value: 12, hint: "Trong ky" },
    { label: "Co hoi", value: 4, hint: "Can bam sat" },
    { label: "Rui ro", value: 3, hint: "Can xu ly" },
    { label: "Theo doi", value: 5, hint: "Da tao viec" }
  ],
  reports: [
    {
      id: "mr-001",
      date: "2026-07-03",
      routeName: "Tuyen Cho Gao",
      accountName: "Diem ban Minh Chau",
      reportType: "price",
      subject: "Gia ke doi thu thap hon",
      competitorName: "Doi thu A",
      price: 16500,
      note: "Gia ban thap hon khoang 1.000d so voi hang minh.",
      nextAction: "Kiem tra chinh sach gia va khuyen mai",
      status: "risk"
    },
    {
      id: "mr-002",
      date: "2026-07-03",
      routeName: "Tuyen Cho Gao",
      accountName: "Diem ban Thanh Phat",
      reportType: "display",
      subject: "Vi tri trung bay tot",
      competitorName: "",
      price: 0,
      note: "Co the xin them mat ke cho SKU chu luc.",
      nextAction: "De xuat POSM va tang hien dien",
      status: "opportunity"
    },
    {
      id: "mr-003",
      date: "2026-07-02",
      routeName: "Tuyen Cai Be",
      accountName: "Diem ban Tan Loi",
      reportType: "stock",
      subject: "Ton kho cham ra",
      competitorName: "",
      price: 0,
      note: "Hang con nhieu, can kiem tra sell-out.",
      nextAction: "Len lich ghe lai va ho tro ban ra",
      status: "normal"
    }
  ]
};
