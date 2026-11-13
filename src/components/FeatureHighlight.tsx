import AnimatedSection from "./AnimatedSection";

interface FeatureHighlightProps {
  title: string;
  description: string;
  image: string;
  imagePosition: "left" | "right";
}

const FeatureHighlight = ({ title, description, image, imagePosition }: FeatureHighlightProps) => {
  return (
    <AnimatedSection animation="fade-in">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className={`flex flex-col ${imagePosition === "left" ? "md:flex-row" : "md:flex-row-reverse"} items-center gap-12`}>
          {/* Image */}
          <div className="w-full md:w-1/2">
            <img 
              src={image} 
              alt={title}
              className="w-full h-auto"
            />
          </div>
          
          {/* Content */}
          <div className="w-full md:w-1/2 text-center md:text-left">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              {title}
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {description}
            </p>
          </div>
        </div>
      </div>
    </AnimatedSection>
  );
};

export default FeatureHighlight;
