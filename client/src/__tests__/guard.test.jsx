import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Guard } from "../Guard.jsx";

const auth = vi.hoisted(() => ({ user: null, loading: false }));
vi.mock("../auth.jsx", () => ({ useAuth: () => auth }));

function renderGuard(roles) {
  return render(
    <MemoryRouter initialEntries={["/prive"]}>
      <Routes>
        <Route
          path="/prive"
          element={
            <Guard roles={roles}>
              <p>Contenu privé</p>
            </Guard>
          }
        />
        <Route path="/connexion" element={<p>Page connexion</p>} />
        <Route path="/" element={<p>Accueil</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("Guard", () => {
  beforeEach(() => {
    auth.user = null;
    auth.loading = false;
  });

  it("redirige un visiteur non connecté", () => {
    renderGuard();
    expect(screen.getByText("Page connexion")).toBeInTheDocument();
    expect(screen.queryByText("Contenu privé")).not.toBeInTheDocument();
  });

  it("redirige un rôle non autorisé", () => {
    auth.user = { id: 1, role: "student" };
    renderGuard(["instructor"]);
    expect(screen.getByText("Accueil")).toBeInTheDocument();
  });

  it("affiche le contenu au bon rôle", () => {
    auth.user = { id: 1, role: "instructor" };
    renderGuard(["instructor"]);
    expect(screen.getByText("Contenu privé")).toBeInTheDocument();
  });
});
