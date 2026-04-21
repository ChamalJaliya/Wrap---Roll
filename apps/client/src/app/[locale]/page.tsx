import { Metadata } from 'next';
import HomeClient from './HomeClient';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isEnglish = locale === 'en';
  return {
    title: isEnglish ? 'Wrap & Roll | Gourmet Street Food Colombo' : 'වැප් ඇන්ඩ් රෝල් | රසවත් වීදි ආහාර',
    description: "Experience Colombo's finest handcrafted wraps and bowls. Fresh ingredients, bold flavors, and vibrant aesthetics.",
    keywords: ['Wraps', 'Colombo Food', 'Street Food', 'Gourmet Wraps', 'Wrap and Roll'],
    openGraph: {
      title: 'Wrap & Roll - Handcrafted Gourmet Wraps',
      description: 'The most vibrant wrap shop in Colombo.',
      images: ['https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=1200'],
      type: 'website',
    },
    alternates: {
      languages: {
        'en-LK': '/en',
        'si-LK': '/si',
        'ta-LK': '/ta',
      },
    }
  };
}

export default function Page() {
  return <HomeClient />;
}
