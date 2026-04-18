export type AuthActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialAuthActionState: AuthActionState = {
  status: "idle",
  message: "",
};
