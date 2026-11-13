import { useState } from "react";
import { ChevronDown, Play, Clock, Users, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Video {
  id: number;
  title: string;
  description: string;
}

interface VideoCategory {
  name: string;
  count: number;
  videos: Video[];
  icon: React.ReactNode;
  color: string;
}

const videoLibraryData: VideoCategory[] = [
  {
    name: "Foundational Setup",
    count: 8,
    icon: <Users className="w-5 h-5" />,
    color: "blue",
    videos: [
      {
        id: 1,
        title: "Create a New Contact",
        description: "Add your first contact effortlessly and begin building meaningful engagement right away."
      },
      {
        id: 2,
        title: "Import and engage with all your contacts instantly",
        description: "Import your existing contacts from various platforms and start engaging with them immediately. Bring all your audience into one place and kickstart your outreach."
      },
      {
        id: 3,
        title: "Generate New Leads with a High-Converting Funnel",
        description: "Set up a high-converting funnel and form to capture leads efficiently. Optimize your lead generation and grow your customer base."
      },
      {
        id: 4,
        title: "Set Up Multi-Channel Communication & Start Engaging in Minutes",
        description: "Connect your email, SMS, and phone services in minutes and start multi-channel communication. Improve your response rates and customer engagement quickly."
      },
      {
        id: 5,
        title: "Launch Your First Campaign to Drive Engagement",
        description: "Design and send your first email campaign to engage over 1,000 contacts. Promote your services, stay top of mind, and drive conversions with targeted emails."
      },
      {
        id: 6,
        title: "Nurture Leads with Automated Drip Campaigns",
        description: "Set up automated email and SMS drip campaigns to nurture 100+ leads over time. Increase conversion rates by following up consistently without manual intervention."
      },
      {
        id: 7,
        title: "Book More Appointments with Automated Scheduling",
        description: "Set up your calendar for automatic appointment bookings. Secure 20 appointments in the first week, with 25% fewer no-shows through automated reminders."
      },
      {
        id: 8,
        title: "Accelerate Deal Closures with a Streamlined Sales Pipeline",
        description: "Organize your sales pipeline to track every lead's progress. Automate follow-ups and close deals faster, ensuring no opportunity is missed."
      }
    ]
  },
  {
    name: "Marketing & Lead Generation",
    count: 3,
    icon: <Play className="w-5 h-5" />,
    color: "purple",
    videos: [
      {
        id: 1,
        title: "Manage All Your Social Media Posts in One Place",
        description: "Set up the social planner to schedule and manage all your social media posts. Maintain a consistent presence across platforms like Facebook, Instagram, and more."
      },
      {
        id: 2,
        title: "Capture New Leads with Facebook & Instagram Lead Ads",
        description: "Connect your Facebook and Instagram channels to manage lead generation ads. Capture high-quality leads directly from social media."
      },
      {
        id: 3,
        title: "Reach Customers with Your First SMS Campaign",
        description: "Design and launch an SMS campaign to instantly reach your audience. Engage customers directly with personalised messages."
      }
    ]
  },
  {
    name: "Sales & Conversation",
    count: 3,
    icon: <Clock className="w-5 h-5" />,
    color: "green",
    videos: [
      {
        id: 1,
        title: "Seamlessly Manage Your Sales Conversations",
        description: "Sync your Gmail or Outlook inbox to track all customer conversations in one place. Never miss a follow-up with integrated email management."
      },
      {
        id: 2,
        title: "Engage Website Visitors in Real Time with Live Chat",
        description: "Add live chat to your website to provide instant support and engage visitors in real time. Convert visitors into leads by offering immediate assistance."
      },
      {
        id: 3,
        title: "Streamline Facebook & Instagram Conversations for Faster Response",
        description: "Connect Facebook and Instagram Messenger to your CRM to manage all conversations in one place. Streamline responses and engage customers faster for improved communication efficiency."
      }
    ]
  },
  {
    name: "Website & Content",
    count: 2,
    icon: <Play className="w-5 h-5" />,
    color: "orange",
    videos: [
      {
        id: 1,
        title: "Launch a Professional Website in Less Than a Day",
        description: "Create and publish a custom website using ready-made templates. Build your online presence quickly and easily."
      },
      {
        id: 2,
        title: "Migrate Your WordPress Site Seamlessly",
        description: "Learn how to move your existing WordPress website to the platform easily without losing any content or functionality."
      }
    ]
  },
  {
    name: "Commerce",
    count: 5,
    icon: <Users className="w-5 h-5" />,
    color: "red",
    videos: [
      {
        id: 1,
        title: "Launch Your First Product and Start Selling",
        description: "Set up and publish your product to start generating sales. Whether it's a physical product, digital service, or subscription, your online store is ready."
      },
      {
        id: 2,
        title: "Launch Your First Online Course and Start Earning",
        description: "Set up and launch an online course in minutes. Start monetizing your expertise and grow your audience with educational content."
      },
      {
        id: 3,
        title: "Start Collecting Payments with Stripe",
        description: "Connect your Stripe account for fast and secure payments. Enable credit card transactions, subscriptions, and more."
      },
      {
        id: 4,
        title: "Accept Payments Easily with a Custom Payment Link",
        description: "Create a payment link and send it to your customers for easy, secure transactions."
      },
      {
        id: 5,
        title: "Generate and Send Professional Invoices",
        description: "Manage your sales and billing by sending customized invoices to your customers."
      }
    ]
  }
];

const VideoLibrary = () => {
  const [expandedCategory, setExpandedCategory] = useState<number | null>(null);

  const toggleCategory = (index: number) => {
    setExpandedCategory(expandedCategory === index ? null : index);
  };

  const getColorClasses = (color: string) => {
    const colorMap = {
      blue: "bg-blue-50 border-blue-200 text-blue-800",
      purple: "bg-purple-50 border-purple-200 text-purple-800",
      green: "bg-green-50 border-green-200 text-green-800",
      orange: "bg-orange-50 border-orange-200 text-orange-800",
      red: "bg-red-50 border-red-200 text-red-800"
    };
    return colorMap[color as keyof typeof colorMap] || colorMap.blue;
  };

  return (
    <div className="py-16 bg-gradient-to-br from-gray-50 to-white">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-12 animate-fade-in">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Complete Video Library
          </h2>
          <p className="text-xl text-gray-600">
            20+ professional training videos to help your clients master every feature
          </p>
        </div>

        <div className="space-y-4">
          {videoLibraryData.map((category, categoryIndex) => (
            <Card
              key={categoryIndex}
              className={`overflow-hidden transition-all duration-300 hover:shadow-lg ${
                expandedCategory === categoryIndex ? 'shadow-xl' : 'shadow-sm'
              }`}
            >
              <div
                className="p-6 cursor-pointer hover:bg-gray-50 transition-colors duration-200"
                onClick={() => toggleCategory(categoryIndex)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`p-3 rounded-lg ${getColorClasses(category.color)}`}>
                      {category.icon}
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">
                        {category.name}
                      </h3>
                      <Badge variant="secondary" className="mt-1">
                        {category.count} videos
                      </Badge>
                    </div>
                  </div>
                  <ChevronDown
                    className={`w-6 h-6 text-gray-400 transition-transform duration-300 ${
                      expandedCategory === categoryIndex ? 'rotate-180' : ''
                    }`}
                  />
                </div>
              </div>

              {/* Expanded Content */}
              <div
                className={`overflow-hidden transition-all duration-500 ease-in-out ${
                  expandedCategory === categoryIndex 
                    ? 'max-h-[2000px] opacity-100' 
                    : 'max-h-0 opacity-0'
                }`}
              >
                <CardContent className="pt-0 pb-6">
                  <div className="space-y-4">
                    {category.videos.map((video, videoIndex) => (
                      <div
                        key={video.id}
                        className="flex items-start space-x-4 p-4 bg-white rounded-lg border border-gray-100 hover:border-gray-200 transition-colors duration-200 hover:shadow-sm"
                      >
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                            <span className="text-sm font-semibold text-primary">
                              {video.id}
                            </span>
                          </div>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 mb-1">
                            {video.title}
                          </h4>
                          <p className="text-sm text-gray-600 leading-relaxed hidden md:block">
                            {video.description}
                          </p>
                        </div>
                        <div className="flex-shrink-0">
                          <Play className="w-5 h-5 text-gray-400 hover:text-primary transition-colors duration-200" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </div>
            </Card>
          ))}
        </div>

        {/* Lite Tool Button Before Brand-Free Text */}
        <div className="text-center mt-12 mb-8">
          <Button 
            size="lg" 
            variant="outline"
            className="text-lg px-8 py-3 border-2 border-black text-black hover:bg-black hover:text-white"
            onClick={() => window.open('https://yoursoftwareonboarding.com/lite', '_blank')}
          >
            Free LITE Onboarding Tool
            <ExternalLink className="w-5 h-5 ml-2" />
          </Button>
        </div>

        <div className="text-center">
          <div className="inline-flex items-center space-x-2 text-sm text-gray-600 bg-white px-4 py-2 rounded-full border border-gray-200">
            <Play className="w-4 h-4" />
            <span>All videos are brand-free and ready for white-label use</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoLibrary;