"use client";

import { useState, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Bell, Car, Moon, Search, Sun, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

/**
 * Design reference (dev only). Every primitive in DeliGo styling, light and
 * dark, plus the colour tokens and the type scale. Copy from here — never
 * restyle a primitive inside a feature.
 */

const BRAND = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];
const BRAND_BG: Record<string, string> = {
  "50": "bg-brand-50",
  "100": "bg-brand-100",
  "200": "bg-brand-200",
  "300": "bg-brand-300",
  "400": "bg-brand-400",
  "500": "bg-brand-500",
  "600": "bg-brand-600",
  "700": "bg-brand-700",
  "800": "bg-brand-800",
  "900": "bg-brand-900",
  "950": "bg-brand-950",
};

const TOKENS = [
  ["background", "bg-background border"],
  ["card", "bg-card border"],
  ["muted", "bg-muted"],
  ["accent", "bg-accent"],
  ["primary", "bg-primary"],
  ["border", "bg-border"],
  ["success", "bg-success"],
  ["warning", "bg-warning"],
  ["danger", "bg-destructive"],
  ["info", "bg-info"],
] as const;

const TYPE_SCALE = [
  ["text-page-title", "Page title", "2xl → sm:3xl → lg:4xl · one per page"],
  ["text-section", "Section heading", "xl → sm:3xl · blocks within a page"],
  ["text-card-title", "Card title", "lg → sm:xl · cards, panels, dialogs"],
  ["text-body", "Body text", "base · paragraphs, forms"],
  ["text-dense", "Dense UI text", "sm · table cells, filters, menus"],
  ["text-caption", "Caption", "xs · labels, hints, timestamps"],
  ["text-micro", "Micro badge", "10px · status pills only"],
] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-card-title">{title}</h2>
      {children}
    </section>
  );
}

export function DesignGallery() {
  const { resolvedTheme, setTheme } = useTheme();
  // The server cannot know the visitor's theme; render the toggle's icon only
  // once mounted so server and client HTML match.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [date, setDate] = useState<Date | undefined>(new Date(2026, 9, 18));
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <main className="mx-auto w-full max-w-6xl space-y-12 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-micro text-primary">DeliGo · Ride Admin</p>
          <h1 className="text-page-title">Design system</h1>
          <p className="text-caption mt-1">
            Dev-only reference (ride_plan.md §F). 404 in production.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          disabled={!mounted}
        >
          {mounted ? isDark ? <Sun /> : <Moon /> : <span className="size-4" />}
          {mounted ? (isDark ? "Light theme" : "Dark theme") : "Theme"}
        </Button>
      </header>

      <Section title="Brand scale (#DC3173 = 600)">
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-11">
          {BRAND.map((step) => (
            <div key={step} className="space-y-1">
              <div className={`h-12 rounded-md ${BRAND_BG[step]}`} />
              <p className="text-caption tabular">{step}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Semantic tokens">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {TOKENS.map(([name, cls]) => (
            <div key={name} className="space-y-1">
              <div className={`h-10 rounded-md ${cls}`} />
              <p className="text-caption">{name}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Typography — standard scale">
        <Card>
          <CardContent className="divide-y">
            {TYPE_SCALE.map(([cls, label, note]) => (
              <div
                key={cls}
                className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:justify-between"
              >
                <span className={cls}>{label}</span>
                <code className="text-caption">
                  {cls} — {note}
                </code>
              </div>
            ))}
          </CardContent>
        </Card>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Approve driver</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">
            <Trash2 /> Suspend
          </Button>
          <Button variant="link">Link</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
          <Button size="icon" aria-label="Notifications">
            <Bell />
          </Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section title="Badges — status tones">
        <div className="flex flex-wrap gap-2">
          <Badge>Default</Badge>
          <Badge variant="success">Completed</Badge>
          <Badge variant="warning">Expires in 12 days</Badge>
          <Badge variant="danger">Cancelled</Badge>
          <Badge variant="info">In progress</Badge>
          <Badge variant="neutral">Scheduled</Badge>
          <Badge variant="brand">Comfort</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>
      </Section>

      <Section title="Form controls">
        <Card>
          <CardContent className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ds-search">Search</Label>
              <div className="relative">
                <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="ds-search" placeholder="Name, email, phone or ID" className="pl-8" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ds-status">Status</Label>
              <Select defaultValue="ACTIVE">
                <SelectTrigger id="ds-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="SUSPENDED">Suspended</SelectItem>
                  <SelectItem value="PENDING_VERIFICATION">Pending verification</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ds-reason">Reason (required for sensitive actions)</Label>
              <Textarea id="ds-reason" placeholder="At least 10 characters" />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="ds-notify" defaultChecked />
              <Label htmlFor="ds-notify">Notify the driver</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="ds-enabled" defaultChecked />
              <Label htmlFor="ds-enabled">Campaign enabled</Label>
            </div>
            <RadioGroup defaultValue="full" className="flex gap-6">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="full" id="ds-full" />
                <Label htmlFor="ds-full">Full refund</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="partial" id="ds-partial" />
                <Label htmlFor="ds-partial">Partial refund</Label>
              </div>
            </RadioGroup>
            <div className="space-y-2">
              <Label>Document review progress</Label>
              <Progress value={64} />
            </div>
          </CardContent>
        </Card>
      </Section>

      <Section title="Card, avatar, separator">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardDescription>Ongoing rides</CardDescription>
              <CardTitle className="text-3xl tabular">128</CardTitle>
            </CardHeader>
            <CardFooter className="text-caption">+12% vs yesterday</CardFooter>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Total ride revenue</CardDescription>
              <CardTitle className="text-3xl tabular">€48 210,50</CardTitle>
            </CardHeader>
            <CardFooter className="text-caption">Last 30 days</CardFooter>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback>JS</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">João Silva</p>
                <p className="text-caption">DRV-20411 · Lisboa</p>
              </div>
            </CardContent>
            <Separator />
            <CardContent className="text-caption">TVDE valid until 12/2027</CardContent>
          </Card>
        </div>
      </Section>

      <Section title="Tabs and table">
        <Tabs defaultValue="ongoing">
          <TabsList>
            <TabsTrigger value="ongoing">Ongoing</TabsTrigger>
            <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>
          <TabsContent value="ongoing">
            <Card className="py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ride ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Fare</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">RIDE-884102</TableCell>
                    <TableCell>Maria Costa</TableCell>
                    <TableCell>
                      <Badge variant="info">In progress</Badge>
                    </TableCell>
                    <TableCell className="text-right">€12,40</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">RIDE-884099</TableCell>
                    <TableCell>Rui Ferreira</TableCell>
                    <TableCell>
                      <Badge variant="neutral">Driver arriving</Badge>
                    </TableCell>
                    <TableCell className="text-right">€8,95</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
          <TabsContent value="scheduled" className="text-caption p-4">
            Scheduled rides appear here.
          </TabsContent>
          <TabsContent value="completed" className="text-caption p-4">
            Completed rides appear here.
          </TabsContent>
        </Tabs>
      </Section>

      <Section title="Overlays">
        <div className="flex flex-wrap gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit vehicle</DialogTitle>
                <DialogDescription>Plate format AA-00-AA.</DialogDescription>
              </DialogHeader>
              <Input defaultValue="AA-12-BB" />
              <DialogFooter>
                <Button>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Confirm dialog</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Suspend this driver?</AlertDialogTitle>
                <AlertDialogDescription>
                  They will be logged out and cannot accept rides until reactivated.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction>Suspend</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">Sheet</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Ride RIDE-884102</SheetTitle>
                <SheetDescription>Quick view from the live map.</SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Row actions</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Driver</DropdownMenuLabel>
              <DropdownMenuItem>View profile</DropdownMenuItem>
              <DropdownMenuItem>Review documents</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive">Suspend</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">Popover</Button>
            </PopoverTrigger>
            <PopoverContent className="text-dense">Last location update: 12 s ago.</PopoverContent>
          </Popover>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Vehicle">
                <Car />
              </Button>
            </TooltipTrigger>
            <TooltipContent>VEH-5012 · Toyota Corolla</TooltipContent>
          </Tooltip>

          <Button
            variant="outline"
            onClick={() =>
              toast.success("Driver approved", { description: "DRV-20411 can now accept rides." })
            }
          >
            Toast
          </Button>
        </div>
      </Section>

      <Section title="Command palette, calendar, skeleton">
        <div className="grid gap-4 lg:grid-cols-3">
          <Command className="rounded-lg border">
            <CommandInput placeholder="Jump to a module or record…" />
            <CommandList>
              <CommandEmpty>No results.</CommandEmpty>
              <CommandGroup heading="Modules">
                <CommandItem>Dashboard</CommandItem>
                <CommandItem>Drivers</CommandItem>
                <CommandItem>Live monitoring</CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
          <Card className="items-center">
            <Calendar mode="single" selected={date} onSelect={setDate} />
          </Card>
          <Card>
            <CardContent className="space-y-3">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>
      </Section>
    </main>
  );
}
