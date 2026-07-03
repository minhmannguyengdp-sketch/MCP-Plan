import type { ActionsData } from "./actions.types";

export const actionsMock: ActionsData = {
  kpis: [
    { label: "Viec mo", value: 9, hint: "Can xu ly" },
    { label: "Uu tien cao", value: 3, hint: "Lam truoc" },
    { label: "Dang lam", value: 4, hint: "Co owner" },
    { label: "Tre han", value: 1, hint: "Can nhac" }
  ],
  items: [
    {
      id: "act-001",
      title: "Ghe lai diem ban dong cua",
      accountName: "Diem ban Ven Song",
      routeName: "Tuyen Go Cong",
      owner: "Sale C",
      source: "session",
      priority: "high",
      status: "todo",
      dueDate: "2026-07-04",
      note: "Bo qua trong phien gan nhat"
    },
    {
      id: "act-002",
      title: "Bo sung hang sap het",
      accountName: "Diem ban Thanh Phat",
      routeName: "Tuyen Cho Gao",
      owner: "Sale A",
      source: "field_check",
      priority: "high",
      status: "doing",
      dueDate: "2026-07-04",
      note: "Ton kho thap"
    },
    {
      id: "act-003",
      title: "Theo don cho giao",
      accountName: "Diem ban Minh Chau",
      routeName: "Tuyen Cho Gao",
      owner: "Kho",
      source: "order",
      priority: "medium",
      status: "doing",
      dueDate: "2026-07-05",
      note: "Don da chot"
    },
    {
      id: "act-004",
      title: "De xuat them diem phat sinh vao tuyen",
      accountName: "Diem ban Phat Sinh",
      routeName: "Tuyen Cho Gao",
      owner: "Admin",
      source: "session",
      priority: "medium",
      status: "todo",
      dueDate: "2026-07-06",
      note: "Can duyet vao tuyen goc"
    },
    {
      id: "act-005",
      title: "Kiem tra gia doi thu",
      accountName: "Diem ban Tan Loi",
      routeName: "Tuyen Cai Be",
      owner: "Sale B",
      source: "field_check",
      priority: "low",
      status: "blocked",
      dueDate: "2026-07-05",
      note: "Thieu anh ke hang"
    }
  ]
};
