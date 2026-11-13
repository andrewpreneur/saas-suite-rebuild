import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type BonusLead = { name: string; email: string; phone: string };
const schema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(255),
  phone: z.string().trim().min(7, "Enter a valid phone").max(30),
});

export default function BonusOptIn({
  onDone,
  busy = false,
  heading = "Tell us where to send your bonuses",
  namePlaceholder = "Name",
  emailPlaceholder = "Email",
  phonePlaceholder = "Phone",
  button = "Send My Bonuses",
}: {
  onDone: (lead: BonusLead) => void;
  busy?: boolean;
  heading?: string;
  namePlaceholder?: string;
  emailPlaceholder?: string;
  phonePlaceholder?: string;
  button?: string;
}) {
  const [values, setValues] = useState<BonusLead>({ name: "", email: "", phone: "" });
  const [error, setError] = useState("");
  return (
    <form noValidate className="space-y-3" onSubmit={(event) => {
      event.preventDefault();
      const parsed = schema.safeParse(values);
      if (!parsed.success) { setError(parsed.error.errors[0]?.message ?? "Check your details"); return; }
      const { name, email, phone } = parsed.data;
      if (typeof name !== "string" || typeof email !== "string" || typeof phone !== "string") return;
      setError("");
      onDone({ name, email, phone });
    }}>
      <h2 className="text-xl font-extrabold text-foreground sm:text-2xl">{heading}</h2>
      <Input aria-label="Name" autoComplete="name" placeholder={namePlaceholder} required maxLength={100} value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} className="h-11 bg-card text-base" />
      <Input aria-label="Email" autoComplete="email" placeholder={emailPlaceholder} required type="email" maxLength={255} value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} className="h-11 bg-card text-base" />
      <Input aria-label="Phone" autoComplete="tel" placeholder={phonePlaceholder} required type="tel" maxLength={30} value={values.phone} onChange={(e) => setValues({ ...values, phone: e.target.value })} className="h-11 bg-card text-base" />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy} className="webinar-2-cta h-12 w-full text-base font-bold">{busy ? "Saving..." : button}</Button>
    </form>
  );
}