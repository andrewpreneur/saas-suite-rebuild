import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { CircleCheck, Plus, Settings, Trash2 } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { isPlatformAdminEmail } from "@/lib/platformAdmins";
import { platformMockEnabled } from "@/lib/platformMock";
import { chartColors } from "@/lib/chart-colors";
import { newUi } from "@/lib/uiVersion";
import { UiVersionSwitch } from "@/components/UiVersionSwitch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TextField } from "@/components/ui/text-field";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tag } from "@/components/ui/tag";
import { Banner } from "@/components/ui/banner";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Living design system page for platform admins.
 * Everything here is the real component and the real color token the app uses,
 * so a change to a token in src/index.css or to a file in components/ui shows up
 * here and across the signed-in app at the same time.
 */
const COLOR_TOKENS: { token: string; use: string }[] = [
  { token: "--brand", use: "Accent buttons, links, focus ring" },
  { token: "--brand-hover", use: "Accent hover" },
  { token: "--brand-subtle", use: "Selected nav, brand wash" },
  { token: "--primary", use: "Black buttons" },
  { token: "--canvas", use: "Signed-in page background" },
  { token: "--card", use: "Cards, dialogs" },
  { token: "--muted", use: "Muted fills, hover" },
  { token: "--muted-foreground", use: "Secondary text" },
  { token: "--border", use: "Dividers" },
  { token: "--input", use: "Form control borders" },
  { token: "--success", use: "Success" },
  { token: "--warning", use: "Warning" },
  { token: "--destructive", use: "Errors, destructive" },
  { token: "--info", use: "Info" },
  { token: "--ink", use: "Dark sections" },
];

const TYPE_SCALE: { name: string; cls: string }[] = [
  { name: "Heading 1 · 36/44", cls: "text-h1" },
  { name: "Heading 2 · 30/38", cls: "text-h2" },
  { name: "Heading 3 · 24/32", cls: "text-h3" },
  { name: "Heading 4 · 20/28", cls: "text-h4" },
  { name: "Body large · 18/28", cls: "text-body-lg" },
  { name: "Body · 16/24", cls: "text-body" },
  { name: "Small · 14/20", cls: "text-small" },
  { name: "Caption · 12/16", cls: "text-caption" },
];

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4 sm:p-6">
      <h2 className="text-h4">{title}</h2>
      {note ? <p className="mt-1 text-sm text-muted-foreground">{note}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function AdminDesignSystem() {
  const { email, isLoading } = useUser();
  const [on, setOn] = useState(true);
  const [checked, setChecked] = useState(true);

  useEffect(() => {
    if (!newUi) return;
    document.body.classList.add("ds-app");
    return () => document.body.classList.remove("ds-app");
  }, []);

  if (isLoading) return null;
  if (!platformMockEnabled && !isPlatformAdminEmail(email)) return <Navigate to="/app" replace />;

  return (
    <TooltipProvider delayDuration={300}>
      <main className="min-h-screen bg-canvas text-foreground">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
          <header>
            <h1 className="text-h2 sm:text-h1">SaaSSuite design system</h1>
            <p className="mt-2 max-w-prose text-muted-foreground">
              Version 0.1. These are the live components and colors the signed-in app uses. Colors live in{" "}
              <code>src/index.css</code>; components live in <code>src/components/ui</code>.
            </p>
          </header>

          {!newUi ? (
            <Banner tone="warning" title="You are viewing the old UI.">
              The components below show their old look. Switch to New UI to see the design system.
            </Banner>
          ) : null}
          <div>
            <UiVersionSwitch />
          </div>

          <Section title="Colors" note="Each swatch reads the live token, so it always matches the app.">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {COLOR_TOKENS.map(({ token, use }) => (
                <div key={token} className="overflow-hidden rounded-lg border">
                  <div className="h-14 border-b" style={{ background: `hsl(var(${token}))` }} />
                  <div className="p-2">
                    <p className="font-mono text-xs font-semibold">{token}</p>
                    <p className="text-xs text-muted-foreground">{use}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm font-medium">Chart colors</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {chartColors.categorical.map((hex) => (
                <span key={hex} className="inline-flex items-center gap-2 rounded-md border px-2 py-1 font-mono text-xs">
                  <span className="size-4 rounded-sm" style={{ background: hex }} />
                  {hex}
                </span>
              ))}
            </div>
          </Section>

          <Section title="Typography" note="Inter. One Heading 1 per page.">
            <div className="flex flex-col gap-3">
              {TYPE_SCALE.map(({ name, cls }) => (
                <div key={cls} className="flex flex-col gap-1 border-b pb-3 last:border-b-0 sm:flex-row sm:items-baseline sm:gap-6">
                  <span className="w-48 shrink-0 font-mono text-xs text-muted-foreground">{cls}</span>
                  <span className={cls}>{name}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Buttons" note="Accent (purple) for the one main action per view. Primary (black) for everything else.">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="accent">Start free trial</Button>
              <Button>Save changes</Button>
              <Button variant="outline">Cancel</Button>
              <Button variant="secondary">Secondary fill</Button>
              <Button variant="ghost">Skip for now</Button>
              <Button variant="destructive">Delete</Button>
              <Button variant="link">View pricing</Button>
              <Button disabled>Unavailable</Button>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button size="sm">Small</Button>
              <Button>Medium</Button>
              <Button size="lg">Large</Button>
              <Button>
                <Plus aria-hidden="true" /> Add client
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Settings">
                    <Settings aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Settings</TooltipContent>
              </Tooltip>
              <Button variant="outline" size="icon" aria-label="Delete">
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          </Section>

          <Section title="Form fields">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Agency name" placeholder="Acme Marketing" />
              <TextField label="Custom domain" hint="Use a subdomain, like app.youragency.com" />
              <TextField label="Phone" type="tel" defaultValue="555" error="Enter a 10-digit phone number" />
              <TextField label="Account ID" value="loc_8f2k19" disabled readOnly />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ds-input">Plain input</Label>
                <Input id="ds-input" placeholder="Type here" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ds-plan">Plan</Label>
                <Select defaultValue="pro">
                  <SelectTrigger id="ds-plan">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="agency">Agency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="ds-notes">Onboarding notes</Label>
                <Textarea id="ds-notes" rows={3} />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-8">
              <div className="flex min-h-11 items-center gap-3">
                <Switch id="ds-switch" checked={on} onCheckedChange={setOn} />
                <Label htmlFor="ds-switch">Email notifications</Label>
              </div>
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <Checkbox checked={checked} onCheckedChange={(value) => setChecked(value === true)} /> New client sign-ups
              </label>
            </div>
          </Section>

          <Section title="Tags, badges and banners" note="The label always says the status; color is never the only signal.">
            <div className="flex flex-wrap items-center gap-2">
              <Tag>Draft</Tag>
              <Tag tone="brand">Pro</Tag>
              <Tag tone="success">
                <CircleCheck aria-hidden="true" /> Active
              </Tag>
              <Tag tone="warning">Trial ends soon</Tag>
              <Tag tone="danger">Past due</Tag>
              <Tag tone="info">New</Tag>
              <Badge>Badge</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="success">Success</Badge>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              <Banner tone="info" title="Heads up.">
                Your HighLevel connection refreshes every night.
              </Banner>
              <Banner tone="success" title="Saved.">
                Your Client Hub is live.
              </Banner>
              <Banner
                tone="warning"
                title="Card expires soon."
                action={
                  <Button size="sm" variant="outline">
                    Update card
                  </Button>
                }
              >
                Update your payment method to avoid an interruption.
              </Banner>
              <Banner tone="error" title="Couldn’t save changes.">
                Check your connection and try again.
              </Banner>
            </div>
            <div className="mt-4 max-w-sm">
              <Progress value={60} aria-label="Example progress" />
            </div>
          </Section>

          <Section title="Tabs, cards and tables">
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="billing">Billing</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
                <TabsTrigger value="integrations" disabled>
                  Integrations
                </TabsTrigger>
              </TabsList>
              <TabsContent value="overview">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Acme Dental</CardTitle>
                      <CardDescription>Pro plan · 4 users</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-gray-700">Cards are white with a 1px border and sit on the grey canvas.</CardContent>
                  </Card>
                  <div className="overflow-hidden rounded-xl border bg-card">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Client</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell>Acme Dental</TableCell>
                          <TableCell>
                            <Tag tone="success">Active</Tag>
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Northstar Agency</TableCell>
                          <TableCell>
                            <Tag tone="warning">Trial</Tag>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="billing" className="text-sm text-muted-foreground">
                Billing panel.
              </TabsContent>
              <TabsContent value="activity" className="text-sm text-muted-foreground">
                Activity panel.
              </TabsContent>
            </Tabs>
          </Section>

          <Section title="Dialog">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Open example dialog</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Invite a teammate</DialogTitle>
                  <DialogDescription>They’ll get an email with a link to join your agency.</DialogDescription>
                </DialogHeader>
                <TextField label="Email" type="email" autoComplete="email" />
                <DialogFooter className="gap-2">
                  <Button variant="outline">Cancel</Button>
                  <Button variant="accent">Send invite</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Section>
        </div>
      </main>
    </TooltipProvider>
  );
}
