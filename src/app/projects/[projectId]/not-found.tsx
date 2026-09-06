import { FileQuestion } from "lucide-react";

export default function ProjectNotFound() {
  return (
    <div className="flex h-[calc(100vh-60px)] w-full flex-col items-center justify-center p-8 text-center bg-background">
      <div className="rounded-full bg-muted p-4 mb-4">
        <FileQuestion className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="text-2xl font-semibold tracking-tight mb-2">Resource Not Found</h2>
      <p className="text-muted-foreground max-w-[400px] mb-6">
        We couldn't find what you were looking for in this project.
      </p>
      {/* We don't redirect outside the project automatically since they might just be on a bad tab. 
          The sidebar is still visible for them to navigate elsewhere. */}
    </div>
  );
}
