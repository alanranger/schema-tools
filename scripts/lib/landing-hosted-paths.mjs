/** 48 landing paths that currently carry a page-header paste. */
export const LANDING_HOSTED_PATHS = [
  '/about-alan-ranger',
  '/academy/login',
  '/awards-and-qualifications',
  '/batsford-arboretum-photography',
  '/beginners-photography-classes',
  '/beginners-portrait-photography-course',
  '/bluebell-woods-near-me',
  '/contact-us-alan-ranger-photography',
  '/copyright-policy-alan-ranger',
  '/corporate-photography-training',
  '/course-finder-photography-classes-near-me',
  '/data-privacy-policy',
  '/fine-art-prints',
  '/free-online-photography-course',
  '/free-photography-tips',
  '/gallery-image-portfolios',
  '/help-portrait-uk-coventry',
  '/help-site-map',
  '/hire-a-professional-photographer-in-coventry',
  '/home',
  '/jaguar-land-rover-els',
  '/landscape-photography-workshops',
  '/my-ethical-policy',
  '/newsletter-signup-form',
  '/outdoor-photography-exposure-calculator',
  '/photo-editing-course-coventry',
  '/photography-courses-coventry',
  '/photography-equipment-recommendations',
  '/photography-gift-vouchers',
  '/photography-lessons-online-121',
  '/photography-mentoring-online-assignments',
  '/photography-payment-plan',
  '/photography-services-near-me',
  '/photography-special-offers',
  '/photography-tuition-services',
  '/photography-workshops',
  '/photography-workshops-near-me',
  '/private-photography-lessons',
  '/professional-commercial-photographer-coventry',
  '/professional-photographer-near-me',
  '/property-photographer-coventry',
  '/rps-courses-mentoring-distinctions',
  '/schedule-an-appointment',
  '/terms-and-conditions',
  '/testimonials-customer-reviews',
  '/website-cookie-policy',
  '/website-terms-and-conditions',
  '/which-photography-style-is-right-for-you'
];

export const LANDING_FAQ_EXPECT_ZERO = [
  '/awards-and-qualifications',
  '/contact-us-alan-ranger-photography',
  '/copyright-policy-alan-ranger',
  '/data-privacy-policy',
  '/free-photography-tips',
  '/gallery-image-portfolios',
  '/help-portrait-uk-coventry',
  '/help-site-map',
  '/newsletter-signup-form',
  '/outdoor-photography-exposure-calculator',
  '/photography-equipment-recommendations',
  '/photography-special-offers',
  '/photography-workshops',
  '/schedule-an-appointment',
  '/terms-and-conditions',
  '/testimonials-customer-reviews',
  '/website-cookie-policy',
  '/website-terms-and-conditions',
  '/which-photography-style-is-right-for-you'
];

export const LANDING_FAQ_KEEP = {
  '/batsford-arboretum-photography': 7,
  '/beginners-photography-classes': 9,
  '/beginners-portrait-photography-course': 11,
  '/bluebell-woods-near-me': 6,
  '/corporate-photography-training': 8,
  '/fine-art-prints': 7,
  '/free-online-photography-course': 12,
  '/hire-a-professional-photographer-in-coventry': 8,
  '/photo-editing-course-coventry': 10,
  '/photography-courses-coventry': 8,
  '/photography-gift-vouchers': 7,
  '/photography-lessons-online-121': 10,
  '/photography-mentoring-online-assignments': 10,
  '/photography-payment-plan': 11,
  '/photography-tuition-services': 8,
  '/photography-workshops-near-me': 7,
  '/private-photography-lessons': 10,
  '/professional-commercial-photographer-coventry': 8,
  '/professional-photographer-near-me': 11,
  '/property-photographer-coventry': 8,
  '/rps-courses-mentoring-distinctions': 10
};

export function landingPathToSlug(p) {
  const path = String(p || '').replace(/\/+$/, '') || '/home';
  const trimmed = path.replace(/^\//, '');
  return (trimmed || 'home').replace(/\//g, '-');
}

export function landingFileName(p) {
  return `${landingPathToSlug(p)}_landing_schema.json`;
}
