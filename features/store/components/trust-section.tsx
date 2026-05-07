import { Truck, Shield, Headphones, RotateCcw } from 'lucide-react';

const trustFeatures = [
  {
    icon: Truck,
    title: 'توصيل سريع',
    description: 'نوصل لجميع محافظات الأردن',
  },
  {
    icon: Shield,
    title: 'منتجات أصلية',
    description: 'جودة مضمونة 100%',
  },
  {
    icon: Headphones,
    title: 'دعم ممتاز',
    description: 'خدمة عملاء على مدار الساعة',
  },
  {
    icon: RotateCcw,
    title: 'استبدال سهل',
    description: 'سياسة إرجاع مرنة',
  },
];

export function TrustSection() {
  return (
    <section className="py-12 md:py-16">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {trustFeatures.map((feature) => (
            <div key={feature.title} className="text-center p-4 rounded-lg bg-muted/50">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
