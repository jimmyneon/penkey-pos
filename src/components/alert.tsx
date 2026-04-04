import { cn } from "@penkey/ui";

interface AlertProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "destructive";
}

export function Alert({ children, className, variant = "default" }: AlertProps) {
  const baseClasses = "p-4 rounded-lg border";
  const variantClasses = variant === "destructive" 
    ? "bg-red-50 border-red-200 text-red-800"
    : "bg-blue-50 border-blue-200 text-blue-800";

  return (
    <div className={cn(baseClasses, variantClasses, className)}>
      {children}
    </div>
  );
}

export function AlertDescription({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("text-sm", className)}>{children}</div>;
}
