export type RsvpStatus = "confirmed" | "declined" | "pending";

export type RsvpGuest = {
  id: string;
  name: string;
  phone: string | null;
  companions: number;
  status: RsvpStatus;
  notes: string | null;
  totalPeople: number;
  createdAt: string;
  updatedAt: string;
};

export type RsvpConfirmationRow = {
  id: string;
  name: string;
  phone: string | null;
  companions: number;
  status: RsvpStatus;
  notes: string | null;
  total_people: number | null;
  created_at: string;
  updated_at: string;
};
