import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Button } from "../../ui/Button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "../../ui/Card";
import { Badge } from "../../ui/Badge";
import { Input } from "../../ui/Input";
import { Switch } from "../../ui/Switch";
import { Tooltip } from "../../ui/Tooltip";
import { Bell } from "lucide-react";

describe("UI Atoms Suite", () => {
  describe("Button Component", () => {
    it("renders with various variants and handles click events", () => {
      const handleClick = vi.fn();
      render(
        <Button variant="primary" onClick={handleClick}>
          Zatwierdź
        </Button>
      );

      const btn = screen.getByRole("button", { name: "Zatwierdź" });
      expect(btn).toBeDefined();
      expect(btn.className).toContain("active:scale-[0.97]");

      fireEvent.click(btn);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("renders loading state with disabled interaction and spinner", () => {
      const handleClick = vi.fn();
      render(
        <Button isLoading onClick={handleClick}>
          Zapisywanie
        </Button>
      );

      const btn = screen.getByRole("button");
      expect(btn.hasAttribute("disabled")).toBe(true);
      fireEvent.click(btn);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it("renders with icon and secondary variant", () => {
      render(
        <Button variant="secondary" leftIcon={<Bell data-testid="bell-icon" />}>
          Powiadomienia
        </Button>
      );

      expect(screen.getByTestId("bell-icon")).toBeDefined();
      expect(screen.getByText("Powiadomienia")).toBeDefined();
    });
  });

  describe("Card Component", () => {
    it("renders standard card with subcomponents", () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Nagłówek</CardTitle>
          </CardHeader>
          <CardContent>Treść karty</CardContent>
          <CardFooter>Stopka karty</CardFooter>
        </Card>
      );

      expect(screen.getByText("Nagłówek")).toBeDefined();
      expect(screen.getByText("Treść karty")).toBeDefined();
      expect(screen.getByText("Stopka karty")).toBeDefined();
    });

    it("renders double-bezel card when doubleBezel prop is true", () => {
      const { container } = render(
        <Card doubleBezel>
          <span>Zawartość double bezel</span>
        </Card>
      );

      expect(container.firstChild).toHaveProperty("className");
      const classStr = (container.firstChild as HTMLElement).className;
      expect(classStr).toContain("rounded-2xl");
      expect(classStr).toContain("border-white/10");
    });
  });

  describe("Badge Component", () => {
    it("renders micro-pill badge with dot and pulse indicator", () => {
      render(
        <Badge variant="emerald" dot pulse>
          Live Status
        </Badge>
      );

      expect(screen.getByText("Live Status")).toBeDefined();
    });

    it("renders different variants (cyan, amber, rose, outline)", () => {
      render(
        <div>
          <Badge variant="cyan">Cyan</Badge>
          <Badge variant="amber">Amber</Badge>
          <Badge variant="rose">Rose</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>
      );

      expect(screen.getByText("Cyan")).toBeDefined();
      expect(screen.getByText("Amber")).toBeDefined();
      expect(screen.getByText("Rose")).toBeDefined();
      expect(screen.getByText("Outline")).toBeDefined();
    });
  });

  describe("Input Component", () => {
    it("renders label, helperText, and error message properly", () => {
      render(
        <Input
          label="Adres E-mail"
          helperText="Wpisz poprawny adres e-mail"
          placeholder="user@example.com"
        />
      );

      expect(screen.getByText("Adres E-mail")).toBeDefined();
      expect(screen.getByText("Wpisz poprawny adres e-mail")).toBeDefined();
      expect(screen.getByPlaceholderText("user@example.com")).toBeDefined();
    });

    it("displays error message instead of helper text when error is present", () => {
      render(
        <Input
          label="Hasło"
          error="Pole jest wymagane"
          helperText="Hasło musi mieć min. 8 znaków"
        />
      );

      expect(screen.getByText("Pole jest wymagane")).toBeDefined();
      expect(screen.queryByText("Hasło musi mieć min. 8 znaków")).toBeNull();
    });
  });

  describe("Switch Component", () => {
    it("toggles state and triggers onCheckedChange", () => {
      const handleChecked = vi.fn();
      render(
        <Switch
          checked={false}
          onCheckedChange={handleChecked}
          label="Powiadomienia SMS"
          description="Otrzymuj alerty o nadchodzących meczach"
        />
      );

      expect(screen.getByText("Powiadomienia SMS")).toBeDefined();
      expect(screen.getByText("Otrzymuj alerty o nadchodzących meczach")).toBeDefined();

      const switchBtn = screen.getByRole("switch");
      expect(switchBtn.getAttribute("aria-checked")).toBe("false");

      fireEvent.click(switchBtn);
      expect(handleChecked).toHaveBeenCalledWith(true);
    });

    it("does not toggle when disabled", () => {
      const handleChecked = vi.fn();
      render(
        <Switch
          checked={true}
          disabled={true}
          onCheckedChange={handleChecked}
          label="Zablokowana opcja"
        />
      );

      const switchBtn = screen.getByRole("switch");
      expect(switchBtn.hasAttribute("disabled")).toBe(true);

      fireEvent.click(switchBtn);
      expect(handleChecked).not.toHaveBeenCalled();
    });
  });

  describe("Tooltip Component", () => {
    it("shows tooltip content on mouse enter and hides on mouse leave", () => {
      render(
        <Tooltip content="Więcej informacji o zasadach">
          <button type="button">Najedź kursorem</button>
        </Tooltip>
      );

      const trigger = screen.getByText("Najedź kursorem");

      // Content initially not visible
      expect(screen.queryByRole("tooltip")).toBeNull();

      // Mouse enter triggers tooltip
      fireEvent.mouseEnter(trigger.parentElement!);
      expect(screen.getByRole("tooltip")).toBeDefined();
      expect(screen.getByText("Więcej informacji o zasadach")).toBeDefined();

      // Mouse leave hides tooltip
      fireEvent.mouseLeave(trigger.parentElement!);
      expect(screen.queryByRole("tooltip")).toBeNull();
    });
  });
});
