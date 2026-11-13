import { useState } from "react";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { testimonials } from "./TestimonialsCarousel";

const TestimonialsPager = () => {
  const [index, setIndex] = useState(0);
  const t = testimonials[index];

  return (
    <div className="w-full max-w-md mx-auto px-6 py-8">
      <h2 className="text-2xl font-bold text-gray-900 text-center mb-6">
        What agency owners say
      </h2>
      <Card className="shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center gap-1 mb-3">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            ))}
          </div>
          <p className="text-gray-700 mb-4 leading-relaxed">{t.review}</p>
          <p className="font-semibold text-gray-900">- {t.name}</p>
        </CardContent>
      </Card>
      <div className="flex items-center justify-center gap-3 mt-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIndex((i) => (i - 1 + testimonials.length) % testimonials.length)}
          aria-label="Previous testimonial"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm text-gray-600">
          {index + 1} / {testimonials.length}
        </span>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIndex((i) => (i + 1) % testimonials.length)}
          aria-label="Next testimonial"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default TestimonialsPager;
