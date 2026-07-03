import type { AccountsData } from "./accounts.types";

export const accountsMock: AccountsData = {
  kpis: [
    { label: "Diem ban active", value: 51, hint: "Dang nam trong cac tuyen MCP" },
    { label: "Can ghe lai", value: 9, hint: "Chua co visit gan nhat hoac chua co don" },
    { label: "Nhom tier A", value: 12, hint: "Diem ban uu tien doanh so" },
    { label: "Doanh so mock", value: "18.4M", hint: "So mau de thiet ke UI" }
  ],
  accounts: [
    {
      id: "acc-cho-gao-001",
      name: "Tap hoa Minh Chau",
      contactName: "Chi Chau",
      area: "Cho Gao",
      routeName: "Tuyen Cho Gao trung tam",
      tier: "A",
      lastVisitDate: "2026-06-30",
      lastOrderDate: "2026-06-29",
      monthlyRevenue: 5200000,
      status: "active"
    },
    {
      id: "acc-cho-gao-002",
      name: "Dai ly Thanh Phat",
      contactName: "Anh Phat",
      area: "Cho Gao",
      routeName: "Tuyen Cho Gao trung tam",
      tier: "A",
      lastVisitDate: "2026-06-30",
      lastOrderDate: "2026-06-29",
      monthlyRevenue: 7100000,
      status: "active"
    },
    {
      id: "acc-my-tho-001",
      name: "Cua hang Huong Que",
      contactName: "Chi Huong",
      area: "My Tho",
      routeName: "Tuyen My Tho phia Dong",
      tier: "B",
      lastVisitDate: "2026-06-28",
      lastOrderDate: "-",
      monthlyRevenue: 0,
      status: "need_visit"
    },
    {
      id: "acc-go-cong-001",
      name: "Tap hoa Ven Song",
      contactName: "Anh Nam",
      area: "Go Cong",
      routeName: "Tuyen Go Cong ven song",
      tier: "C",
      lastVisitDate: "2026-06-25",
      lastOrderDate: "-",
      monthlyRevenue: 0,
      status: "need_visit"
    },
    {
      id: "acc-cai-be-001",
      name: "Dai ly Tan Loi",
      contactName: "Chi Loi",
      area: "Cai Be",
      routeName: "Tuyen Cai Be dai ly moi",
      tier: "B",
      lastVisitDate: "2026-06-30",
      lastOrderDate: "2026-06-30",
      monthlyRevenue: 6100000,
      status: "active"
    },
    {
      id: "acc-data-001",
      name: "Diem ban thieu thong tin",
      contactName: "Chua cap nhat",
      area: "Tong hop",
      routeName: "Tuyen bao tri du lieu",
      tier: "C",
      lastVisitDate: "-",
      lastOrderDate: "-",
      monthlyRevenue: 0,
      status: "inactive"
    }
  ]
};
