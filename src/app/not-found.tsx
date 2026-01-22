import { Metadata } from 'next';
import NotFoundClient from './not-found-client';

export const metadata: Metadata = {
  title: '404 - Page Not Found | Gatewayz',
  description:
    'The page you are looking for has evolved beyond this URL. Watch Conway\'s Game of Life instead!',
};

export default function NotFound() {
  return <NotFoundClient />;
}
