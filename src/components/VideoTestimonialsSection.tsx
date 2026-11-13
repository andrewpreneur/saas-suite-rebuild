import { useEffect, useRef, useState } from "react";
import { Play, Star } from "lucide-react";

const BASE = "https://assets.cdn.filesafe.space/T69cI1milcirIORef4Ib/media/";

type Testimonial = {
  id: string;
  file: string;
  poster: string;
  vertical: boolean;
  quote: string;
  name: string;
};

export const TESTIMONIALS: Testimonial[] = [
  {
    id: "ben",
    file: "6a8f803ad1afbd2cbcc11542.mov",
    poster: "/assets/testimonial-thumbnails/ben.webp",
    vertical: true,
    quote:
      "Andrew always follows through with what he says he's going to do. He's taken really good care of us. Highly recommend him and his Agency.",
    name: "Ben",
  },
  {
    id: "brentney",
    file: "6a8f803414ad347ccb72b6a6.mov",
    poster: "/assets/testimonial-thumbnails/brentney.webp",
    vertical: true,
    quote:
      "SaaSSuite.ai is AMAZING. I was so confused, I didn't know how to support my customers — now I have a clear plan and I can move forward. Thank you thank you thank you so much Andrew!",
    name: "Brentney",
  },
  {
    id: "mason",
    file: "6a8f8031722007d7ffdda9c1.mov",
    poster: "/assets/testimonial-thumbnails/mason.webp",
    vertical: false,
    quote: "Wow. Okay. I should just start doing that. Thank you!",
    name: "Mason",
  },
  {
    id: "rob",
    file: "6a8f8031d6548da0f13bb2aa.mov",
    poster: "/assets/testimonial-thumbnails/rob.webp",
    vertical: false,
    quote: "SaaSSuite is Amazing. Shoutout to Andrew, love what he's doing. Highly recommend!",
    name: "Rob",
  },
  {
    id: "jess",
    file: "6a8f80317ac084b1125b80e2.mov",
    poster: "/assets/testimonial-thumbnails/jess.webp",
    vertical: false,
    quote: "You're so helpful, you're on top of everything for us. Thank you so much!",
    name: "Jess",
  },
  {
    id: "lee",
    file: "6a8f8031722007d7ffdda9bd.mov",
    poster: "/assets/testimonial-thumbnails/lee.webp",
    vertical: true,
    quote:
      "Andrew's one of the kindest humans you would meet. He put together a plan for me that was highly effective, comprehensive, and accessible. The skills, knowledge, professionalism — he knew exactly what I needed to grow on the platform. I owe Andrew a great deal of gratitude.",
    name: "Lee",
  },
  {
    id: "mark",
    file: "6a8f80311a899e4264477ad0.mp4",
    poster: "/assets/testimonial-thumbnails/mark.webp",
    vertical: true,
    quote:
      "I closed $25,000 in new clients in two weeks. He knows how to make deals people can't refuse, and has brought me numerous paying clients and saved multiple deals. Thanks a lot Andrew!",
    name: "Mark",
  },
  {
    id: "tania",
    file: "6a8f8031d6548da0f13bb2b3.mov",
    poster: "/assets/testimonial-thumbnails/tania.webp",
    vertical: false,
    quote: "I love you so much, you don't even know. Thank you so much!",
    name: "Tania",
  },
];

const byId = (id: string) => TESTIMONIALS.find((t) => t.id === id)!;

const GoldStars = ({ className = "w-4 h-4" }: { className?: string }) => (
  <div className="flex items-center gap-1" aria-hidden="true">
    {[0, 1, 2, 3, 4].map((i) => (
      <Star key={i} className={`${className} text-gold fill-gold`} />
    ))}
  </div>
);

const VideoTestimonialCard = ({
  testimonial,
  align,
  deferPoster = false,
}: {
  testimonial: Testimonial;
  align: "left" | "right";
  deferPoster?: boolean;
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const figureRef = useRef<HTMLElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [posterReady, setPosterReady] = useState(!deferPoster);

  useEffect(() => {
    if (!deferPoster || posterReady) return;
    const node = figureRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setPosterReady(true);
      },
      { rootMargin: "240px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [deferPoster, posterReady]);

  useEffect(() => {
    if (!playing) return;
    const video = videoRef.current;
    if (!video) return;
    video.load();
    video.play().catch(() => {});
  }, [playing]);

  const handlePlay = () => {
    setPlaying(true);
  };

  return (
    <figure
      ref={figureRef}
      className={`glass-card frost-border rounded-2xl overflow-hidden mb-6 w-full md:w-[92%] ${
        align === "right" ? "md:ml-auto" : "md:mr-auto"
      }`}
    >
      <div className="relative bg-black">
        <video
          ref={videoRef}
          src={playing ? `${BASE}${testimonial.file}` : undefined}
          poster={posterReady ? testimonial.poster : undefined}
          preload="none"
          playsInline
          controls={playing}
          className={`w-full object-cover ${testimonial.vertical ? "aspect-[9/16]" : "aspect-video"}`}
        />
        {!playing && (
          <button
            type="button"
            onClick={handlePlay}
            className="absolute inset-0 flex items-center justify-center"
            aria-label={`Play testimonial from ${testimonial.name}`}
          >
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center transition-transform duration-300 hover:scale-110"
              style={{ backgroundColor: "#0A84FF" }}
            >
              <Play className="w-3.5 h-3.5 text-white ml-0.5" fill="white" />
            </span>
          </button>
        )}
      </div>
      <figcaption className="p-5">
        <GoldStars />
        <p className="mt-3 text-gray-700 leading-relaxed">&ldquo;{testimonial.quote}&rdquo;</p>
        <p className="mt-3 font-semibold text-gray-900">&mdash; {testimonial.name}</p>
      </figcaption>
    </figure>
  );
};

// Desktop: three explicit fixed columns (CSS columns would reorder the cards).
const DESKTOP_COLUMNS: { id: string; align: "left" | "right" }[][] = [
  [
    { id: "ben", align: "left" },
    { id: "rob", align: "right" },
  ],
  [
    { id: "brentney", align: "left" },
    { id: "jess", align: "right" },
    { id: "mark", align: "left" },
  ],
  [
    { id: "mason", align: "right" },
    { id: "lee", align: "left" },
    { id: "tania", align: "right" },
  ],
];

const VideoTestimonialsSection = ({ deferPosters = false }: { deferPosters?: boolean }) => {
  useEffect(() => {
    if (deferPosters) return;
    TESTIMONIALS.forEach(({ poster }) => {
      const image = new Image();
      image.src = poster;
    });
  }, [deferPosters]);

  return (
  <section className="max-w-6xl mx-auto px-6 pb-12 pt-9">
    <div className="text-center mb-8">
      <div className="flex items-center justify-center gap-1 mb-4" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} className="w-8 h-8 md:w-10 md:h-10 text-gold fill-gold" />
        ))}
      </div>
      <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
        Hear from our customers
      </h2>
    </div>

    {/* Mobile / tablet */}
    <div className="grid grid-cols-2 md:grid-cols-2 gap-3 lg:hidden">
      {TESTIMONIALS.map((t, i) => (
        <VideoTestimonialCard key={t.id} testimonial={t} align={i % 2 === 0 ? "left" : "right"} deferPoster={deferPosters} />
      ))}
    </div>

    {/* Desktop */}
    <div className="hidden lg:flex lg:gap-6">
      {DESKTOP_COLUMNS.map((col, ci) => (
        <div key={ci} className="flex-1 min-w-0">
          {col.map((item) => (
            <VideoTestimonialCard key={item.id} testimonial={byId(item.id)} align={item.align} deferPoster={deferPosters} />
          ))}
        </div>
      ))}
    </div>
  </section>
  );
};

export default VideoTestimonialsSection;
