/**
 * Carousel Library Page - Phase 6
 * 
 * Display all user's saved carousels with search, filter, and actions.
 * Now includes Share functionality with analytics.
 * 
 * Location: src/pages/CarouselLibrary.tsx
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import {
  getUserCarousels,
  deleteCarousel,
  duplicateCarousel,
  toggleCarouselPublic,
} from '../services/carouselService';
import { Carousel } from '../lib/supabaseClient';
import { ShareModal } from '../components/ShareModal';
import { injectContentIntoSvg } from '../utils/svgInjector';
import { dbToAppTemplate } from '../utils/templateConverter';
import {
  Plus,
  Search,
  Grid,
  List,
  Calendar,
  Trash2,
  Copy,
  Edit,
  Eye,
  EyeOff,
  MoreVertical,
  Layout,
  Share2,
} from 'lucide-react';

export const CarouselLibrary: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [carousels, setCarousels] = useState<Carousel[]>([]);
  const [filteredCarousels, setFilteredCarousels] = useState<Carousel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'template-1' | 'template-2'>('all');
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [carouselToShare, setCarouselToShare] = useState<Carousel | null>(null);

  // Load carousels on mount
  useEffect(() => {
    if (user) {
      loadCarousels();
    }
  }, [user]);

  // Filter carousels when search or filter changes
  useEffect(() => {
    filterCarousels();
  }, [searchQuery, selectedFilter, carousels]);

  const loadCarousels = async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await getUserCarousels(user.id);

    if (!error && data) {
      setCarousels(data);
    }

    setLoading(false);
  };

  const filterCarousels = () => {
    let filtered = [...carousels];

    // Apply template filter
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(c => c.template_type === (selectedFilter as 'template1' | 'template2'));
    }

    // Apply search query
    if (searchQuery) {
      filtered = filtered.filter(c =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredCarousels(filtered);
  };

  const handleDelete = async (carouselId: string) => {
    if (!window.confirm('Are you sure you want to delete this carousel?')) return;

    const { error } = await deleteCarousel(carouselId);

    if (!error) {
      setCarousels(carousels.filter(c => c.id !== carouselId));
      setActionMenuOpen(null);
    }
  };

  const handleDuplicate = async (carouselId: string) => {
    if (!user) return;

    const { data, error } = await duplicateCarousel(carouselId, user.id);

    if (!error && data) {
      setCarousels([data, ...carousels]);
      setActionMenuOpen(null);
    }
  };

  const handleTogglePublic = async (carousel: Carousel) => {
    const { data, error } = await toggleCarouselPublic(carousel.id, !carousel.is_public);

    if (!error && data) {
      setCarousels(carousels.map(c => c.id === carousel.id ? data : c));
      setActionMenuOpen(null);
    }
  };

  const handleEdit = (carousel: Carousel) => {
    // Navigate to home with carousel data - reuses main interface!
    navigate('/', {
      state: {
        editMode: true,
        carouselId: carousel.id,
        carousel: carousel
      }
    });
  };

  const handleShare = (carousel: Carousel) => {
    setCarouselToShare(carousel);
    setShareModalOpen(true);
    setActionMenuOpen(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getTemplateLabel = (template: string) => {
    return template === 'template-1' ? 'The Truth' : 'The Clarity';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-white/60 text-sm">Loading your carousels...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* Header */}
      <header className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-neutral-900">
        <div className="flex items-center gap-3">
          <Link to="/" className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg shadow-lg shadow-blue-900/20">
            <Layout className="w-5 h-5 text-white" />
          </Link>
          <h1 className="text-lg font-bold tracking-tight">My Carousels</h1>
          <span className="text-sm text-neutral-400">({carousels.length})</span>
        </div>

        <Link
          to="/"
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-lg text-sm font-medium transition-all"
        >
          <Plus size={16} />
          New Carousel
        </Link>
      </header>

      {/* Main Content */}
      <main className="p-6 max-w-7xl mx-auto">
        {/* Filters & Search */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search carousels..."
              className="w-full pl-11 pr-4 py-2 bg-neutral-900 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-3">
            {/* Template Filter */}
            <div className="flex gap-2 bg-neutral-900 border border-white/10 rounded-lg p-1">
              <button
                onClick={() => setSelectedFilter('all')}
                className={`px-3 py-1 rounded text-sm transition-colors ${selectedFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'text-neutral-400 hover:text-white'
                  }`}
              >
                All
              </button>
              <button
                onClick={() => setSelectedFilter('template-1')}
                className={`px-3 py-1 rounded text-sm transition-colors ${selectedFilter === 'template-1'
                  ? 'bg-blue-600 text-white'
                  : 'text-neutral-400 hover:text-white'
                  }`}
              >
                Truth
              </button>
              <button
                onClick={() => setSelectedFilter('template-2')}
                className={`px-3 py-1 rounded text-sm transition-colors ${selectedFilter === 'template-2'
                  ? 'bg-blue-600 text-white'
                  : 'text-neutral-400 hover:text-white'
                  }`}
              >
                Clarity
              </button>
            </div>

            {/* View Mode Toggle */}
            <div className="flex gap-1 bg-neutral-900 border border-white/10 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded transition-colors ${viewMode === 'grid'
                  ? 'bg-blue-600 text-white'
                  : 'text-neutral-400 hover:text-white'
                  }`}
              >
                <Grid size={16} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded transition-colors ${viewMode === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'text-neutral-400 hover:text-white'
                  }`}
              >
                <List size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Carousels Grid/List */}
        {filteredCarousels.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-neutral-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <Layout className="w-8 h-8 text-neutral-600" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              {searchQuery || selectedFilter !== 'all' ? 'No carousels found' : 'No carousels yet'}
            </h3>
            <p className="text-neutral-400 mb-6">
              {searchQuery || selectedFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Create your first carousel to get started'}
            </p>
            {!searchQuery && selectedFilter === 'all' && (
              <Link
                to="/"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-lg font-medium transition-all"
              >
                <Plus size={18} />
                Create Carousel
              </Link>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCarousels.map((carousel) => (
              <div
                key={carousel.id}
                className="bg-neutral-900 border border-white/10 rounded-xl overflow-hidden hover:border-blue-500/50 transition-all group"
              >
                {/* Thumbnail */}
                <div className="aspect-[4/3] bg-gradient-to-br from-neutral-800 to-neutral-900 flex items-center justify-center relative overflow-hidden">
                  {carousel.slides && carousel.slides.length > 0 ? (
                    <div
                      className="w-full h-full flex items-center justify-center p-4"
                      dangerouslySetInnerHTML={{
                        __html: injectContentIntoSvg(
                          dbToAppTemplate(carousel.template_type),
                          carousel.slides[0] as any,
                          carousel.theme
                        )
                      }}
                      style={{
                        transform: 'scale(0.35)',
                        transformOrigin: 'center'
                      }}
                    />
                  ) : (
                    <Layout className="w-12 h-12 text-neutral-700" />
                  )}
                  <div className="absolute top-3 right-3 flex gap-2">
                    {carousel.is_public && (
                      <div className="px-2 py-1 bg-green-500/10 border border-green-500/50 rounded text-xs text-green-400 flex items-center gap-1">
                        <Eye size={12} />
                        Public
                      </div>
                    )}
                  </div>
                  {/* Views counter */}
                  {(carousel as any).views > 0 && (
                    <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/50 backdrop-blur-sm rounded text-xs text-white flex items-center gap-1">
                      <Eye size={12} />
                      {(carousel as any).views}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="font-bold text-white mb-1 truncate">{carousel.title}</h3>
                  <div className="flex items-center gap-3 text-xs text-neutral-500 mb-4">
                    <span>{getTemplateLabel(carousel.template_type)}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {formatDate(carousel.created_at)}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(carousel)}
                      className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleShare(carousel)}
                      className="p-2 bg-neutral-800 hover:bg-neutral-700 border border-white/10 rounded-lg transition-colors"
                      title="Share"
                    >
                      <Share2 size={16} />
                    </button>
                    <div className="relative">
                      <button
                        onClick={() => setActionMenuOpen(actionMenuOpen === carousel.id ? null : carousel.id)}
                        className="p-2 bg-neutral-800 hover:bg-neutral-700 border border-white/10 rounded-lg transition-colors"
                      >
                        <MoreVertical size={16} />
                      </button>

                      {/* Action Menu */}
                      {actionMenuOpen === carousel.id && (
                        <div className="absolute right-0 top-full mt-2 w-48 bg-neutral-800 border border-white/10 rounded-lg shadow-xl overflow-hidden z-10">
                          <button
                            onClick={() => handleDuplicate(carousel.id)}
                            className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white/5 flex items-center gap-2 transition-colors"
                          >
                            <Copy size={14} />
                            Duplicate
                          </button>
                          <button
                            onClick={() => handleTogglePublic(carousel)}
                            className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white/5 flex items-center gap-2 transition-colors"
                          >
                            {carousel.is_public ? <EyeOff size={14} /> : <Eye size={14} />}
                            Make {carousel.is_public ? 'Private' : 'Public'}
                          </button>
                          <button
                            onClick={() => handleDelete(carousel.id)}
                            className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors border-t border-white/10"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredCarousels.map((carousel) => (
              <div
                key={carousel.id}
                className="bg-neutral-900 border border-white/10 rounded-lg p-4 hover:border-blue-500/50 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-16 h-16 bg-gradient-to-br from-neutral-800 to-neutral-900 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {carousel.slides && carousel.slides.length > 0 ? (
                      <div
                        className="w-full h-full"
                        dangerouslySetInnerHTML={{
                          __html: injectContentIntoSvg(
                            dbToAppTemplate(carousel.template_type),
                            carousel.slides[0] as any,
                            carousel.theme
                          )
                        }}
                        style={{
                          transform: 'scale(0.06)',
                          transformOrigin: 'center'
                        }}
                      />
                    ) : (
                      <Layout className="w-6 h-6 text-neutral-600" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white truncate mb-1">{carousel.title}</h3>
                    <div className="flex items-center gap-3 text-xs text-neutral-500">
                      <span>{getTemplateLabel(carousel.template_type)}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {formatDate(carousel.created_at)}
                      </span>
                      {carousel.is_public && (
                        <>
                          <span>•</span>
                          <span className="text-green-400 flex items-center gap-1">
                            <Eye size={12} />
                            Public
                          </span>
                        </>
                      )}
                      {(carousel as any).views > 0 && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Eye size={12} />
                            {(carousel as any).views} views
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(carousel)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleShare(carousel)}
                    className="p-2 bg-neutral-800 hover:bg-neutral-700 border border-white/10 rounded-lg transition-colors"
                    title="Share"
                  >
                    <Share2 size={16} />
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setActionMenuOpen(actionMenuOpen === carousel.id ? null : carousel.id)}
                      className="p-2 bg-neutral-800 hover:bg-neutral-700 border border-white/10 rounded-lg transition-colors"
                    >
                      <MoreVertical size={16} />
                    </button>

                    {actionMenuOpen === carousel.id && (
                      <div className="absolute right-0 top-full mt-2 w-48 bg-neutral-800 border border-white/10 rounded-lg shadow-xl overflow-hidden z-10">
                        <button
                          onClick={() => handleDuplicate(carousel.id)}
                          className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white/5 flex items-center gap-2 transition-colors"
                        >
                          <Copy size={14} />
                          Duplicate
                        </button>
                        <button
                          onClick={() => handleTogglePublic(carousel)}
                          className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white/5 flex items-center gap-2 transition-colors"
                        >
                          {carousel.is_public ? <EyeOff size={14} /> : <Eye size={14} />}
                          Make {carousel.is_public ? 'Private' : 'Public'}
                        </button>
                        <button
                          onClick={() => handleDelete(carousel.id)}
                          className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors border-t border-white/10"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Share Modal */}
      {carouselToShare && (
        <ShareModal
          isOpen={shareModalOpen}
          onClose={() => {
            setShareModalOpen(false);
            setCarouselToShare(null);
          }}
          carousel={carouselToShare}
        />
      )}
    </div>
  );
};

export default CarouselLibrary;