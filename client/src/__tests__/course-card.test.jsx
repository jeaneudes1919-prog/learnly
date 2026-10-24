import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { CourseCard } from "../pub.jsx";
import { UIProvider } from "../ui.jsx";

vi.mock("../auth.jsx", () => ({
  useAuth: () => ({ user: { id: 1, role: "student", name: "Ama", avatarColor: "#1E3A8A" } }),
}));

vi.mock("../api.js", () => ({
  api: {
    get: vi.fn(() => Promise.resolve({ saved: false })),
    post: vi.fn(() => Promise.resolve({ saved: true })),
    del: vi.fn(() => Promise.resolve({ saved: false })),
  },
  errMsg: () => "Erreur",
}));

const course = {
  id: 1,
  slug: "maitriser-react-de-zero",
  title: "Maîtriser React de zéro",
  level: "debutant",
  price: 0,
  color: "#1E3A8A",
  category: { name: "Développement web", icon: "💻", slug: "dev" },
  instructor: { id: 1, name: "Prof. Armand Kiki", headline: "Formateur" },
  rating: 4.5,
  ratingCount: 12,
  students: 34,
  duration: 90,
};

describe("CourseCard", () => {
  it("affiche les informations du cours et le bouton favori", async () => {
    render(
      <MemoryRouter>
        <UIProvider>
          <CourseCard c={course} />
        </UIProvider>
      </MemoryRouter>
    );
    expect(screen.getByText("Maîtriser React de zéro")).toBeInTheDocument();
    expect(screen.getByText("Prof. Armand Kiki")).toBeInTheDocument();
    expect(screen.getByText("Gratuit")).toBeInTheDocument();
    expect(screen.getByLabelText("Ajouter aux favoris")).toBeInTheDocument();
  });
});
