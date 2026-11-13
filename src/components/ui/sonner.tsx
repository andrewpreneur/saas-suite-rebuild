import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      // Top right, under the top bar: bottom corners hold the save bar and the Copilot launcher.
      position="top-right"
      offset={68}
      visibleToasts={3}
      duration={5000}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:rounded-xl group-[.toaster]:border-gray-300 group-[.toaster]:bg-white group-[.toaster]:text-foreground group-[.toaster]:shadow-popover",
          description: "group-[.toast]:text-gray-700",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
