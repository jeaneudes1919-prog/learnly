import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AuthPage } from "../pub.jsx";
import { UIProvider } from "../ui.jsx";

vi.mock("../auth.jsx", () => ({
  useAuth: () => ({ user: null, login: vi.fn(), register: vi.fn() }),
}));

describe("page de connexion", () => {
  it("remplit les identifiants de démonstration", async () => {
    render(
      <MemoryRouter initialEntries={["/connexion"]}>
        <UIProvider>
          <AuthPage />
        </UIProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Bon retour !" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Apprenant \(démo\)/ }));
    expect(screen.getByRole("textbox")).toHaveValue("student@learnly.dev");
    expect(screen.getByPlaceholderText("8 caractères minimum")).toHaveValue("Learnly2026!");
  });
});
