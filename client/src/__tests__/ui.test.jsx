import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Stars } from "../ui.jsx";

describe("composant Stars", () => {
  it("affiche cinq étoiles et remonte la note choisie", async () => {
    const onChange = vi.fn();
    render(<Stars value={2} onChange={onChange} />);
    expect(screen.getAllByRole("button")).toHaveLength(5);
    await userEvent.click(screen.getByLabelText("4 étoile(s)"));
    expect(onChange).toHaveBeenCalledWith(4);
  });
});
