interface AdminPlaceholderProps {
  title: string;
  description: string;
}

export function AdminPlaceholder({ title, description }: AdminPlaceholderProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="rounded-lg border bg-card p-8 text-center shadow-sm">
        <p className="text-lg font-semibold">قريبًا</p>
        <p className="mt-2 text-sm text-muted-foreground">
          هذه الصفحة محمية وجاهزة كبوابة مؤقتة إلى أن يتم بناء الإدارة الكاملة.
        </p>
      </div>
    </div>
  );
}
