import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import AppRouter from './router/AppRouter';

/**
 * App — root component that wraps all pages with Navbar + Footer.
 * BrowserRouter and QueryClientProvider are in main.jsx.
 */
export default function App() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1">
        <AppRouter />
      </main>
      <Footer />
    </div>
  );
}
