import { Navigate, Route, Routes } from "react-router-dom";

import Home from "./pages/Home";
import AnimeDetails from "./pages/AnimeDetails";
import Watch from "./pages/Watch";
import AnimeCatalog from "./pages/AnimeCatlog";
import Profile from "./pages/Profile";
import Login from "./pages/Login";

import ProtectedRoute from "./components/ProtectedRoute";
import ScrollToTop from "./components/ScrollToTop";

function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#08080d] px-6 text-center text-white">
      <div>
        <h1 className="text-5xl font-black text-pink-400">
          404
        </h1>

        <p className="mt-3 text-zinc-400">
          This page doesn't exist.
        </p>

        <a
          href="/home"
          className="mt-6 inline-block rounded-xl bg-pink-500 px-5 py-3 font-semibold text-white transition hover:bg-pink-400"
        >
          Back to home
        </a>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <>
      <ScrollToTop />

      <Routes>
        {/* Open the homepage when someone visits the website */}
        <Route
          path="/"
          element={<Navigate to="/home" replace />}
        />

        {/* Public routes */}
        <Route path="/home" element={<Home />} />
        <Route path="/trending" element={<AnimeCatalog />} />
        <Route path="/top-rated" element={<AnimeCatalog />} />
        <Route path="/popular" element={<AnimeCatalog />} />
        <Route path="/search" element={<AnimeCatalog />} />
        <Route path="/anime/:id" element={<AnimeDetails />} />

        {/* Login and signup */}
        <Route path="/login" element={<Login />} />

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/profile" element={<Profile />} />
          <Route path="/watch/:id" element={<Watch />} />
        </Route>

        {/* Unknown routes */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}