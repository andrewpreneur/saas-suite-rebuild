import { Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
export const testimonials = [{
  name: "Mark",
  review: "I stopped paying $1,000/month for agency support. I pay 1/10th of that for an AI + human team that knows my business and HighLevel better than anyone."
}, {
  name: "Melissa",
  review: "I stopped paying $1,000 for agency support. I've tried every single big provider. SaaSSuite is the only option that actually supports my business growth and it's less than 1/10th of the cost."
}, {
  name: "Umar",
  review: "My clients get answers in under a minute - nights, weekends, whenever. I used to BE the support desk. Now I just watch the tickets close themselves."
}, {
  name: "Yohannes C.",
  review: "The onboarding videos alone are worth it. New clients watch them, set themselves up, and stop calling me with the same ten questions. My last three clients never needed a single setup call."
}, {
  name: "Nick V.",
  review: "Voice AI that calls my new clients, a knowledge base with my branding on it, health scores that flag churn before it happens - for $97 a month. I was quoted $2,000/month for a person who does less."
}, {
  name: "Jacob R.",
  review: "Unlimited sub-accounts changed the math for me. Every client I add gets full support and training without my costs going up. I finally onboard clients without hiring."
}];
const TestimonialsCarousel = () => {
  // Duplicate testimonials for seamless loop
  const duplicatedTestimonials = [...testimonials, ...testimonials];
  return <div className="py-16 overflow-hidden relative">
      
      
      {/* Scrolling container */}
      <div className="relative">
        <div className="flex gap-6 animate-scroll">
          {duplicatedTestimonials.map((testimonial, index) => <Card key={index} className="flex-shrink-0 w-[200px] sm:w-[400px] shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center gap-1 mb-3">
                  {[...Array(5)].map((_, i) => <Star key={i} className="w-3 h-3 sm:w-5 sm:h-5 fill-yellow-400 text-yellow-400" />)}
                </div>
                <p className="text-xs sm:text-base text-gray-700 mb-4 leading-relaxed">
                  {testimonial.review}
                </p>
                <p className="text-xs sm:text-base font-semibold text-gray-900">
                  {testimonial.name}
                </p>
              </CardContent>
            </Card>)}
        </div>
      </div>
    </div>;
};
export default TestimonialsCarousel;