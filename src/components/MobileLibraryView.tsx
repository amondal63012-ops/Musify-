import React, { useRef, useState, useMemo } from 'react';
import {
  Plus,
  Heart,
  Music,
  HardDriveDownload,
  Upload,
  Play,
  Pause,
  Trash2,
  LayoutGrid,
  List as ListIcon,
  Clock,
  Disc3,
  UserCheck,
} from 'lucide-react';
import { Artist, Playlist, SavedAlbum, Track } from '../types';
import { ECHO_COVERS } from './echoCovers';
import SearchBar from './design/SearchBar';
import SectionHeader from './design/SectionHeader';
import PlaylistCard from './design/PlaylistCard';
import AlbumCard from './design/AlbumCard';
import ArtistCard from './design/ArtistCard';
import SongRow from './design/SongRow';

interface MobileLibraryViewProps {
  playlists: Playlist[];
  offlineTracks: Track[];
  savedAlbums: SavedAlbum[];
  followedArtists: Artist[];
  recentlyPlayed: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  onSelectPlaylist: (playlist: Playlist) => void;
  onCreatePlaylist: () => void;
  onPlayTrack: (track: Track, contextPlaylist?: Playlist, contextTrackList?: Track[]) => void;
  onImportLocalFiles: (files: FileList) => Promise<void>;
  onRemoveOfflineTrack: (trackId: string) => Promise<void>;
  onSelectArtist: (artistId: string) => void;
  onToggleSaveAlbum: (album: SavedAlbum) => void;
}

type LibraryFilter = 'all' | 'playlists' | 'albums' | 'artists' | 'offline';
type LibrarySort = 'recent' | 'az' | 'tracks';

export default function MobileLibraryView({
  playlists,
  offlineTracks,
  savedAlbums,
  followedArtists,
  recentlyPlayed,
  currentTrack,
  isPlaying,
  onSelectPlaylist,
  onCreatePlaylist,
  onPlayTrack,
  onImportLocalFiles,
  onRemoveOfflineTrack,
  onSelectArtist,
  onToggleSaveAlbum,
}: MobileLibraryViewProps) {
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [sortBy, setSortBy] = useState<LibrarySort>('recent');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [searchFilter, setSearchFilter] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const q = searchFilter.trim().toLowerCase();

  const likedPlaylist = useMemo(
    () => playlists.find((p) => p.isLikedSongs) || null,
    [playlists]
  );

  const filteredPlaylists = useMemo(() => {
    const list = playlists.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
    if (sortBy === 'az') {
      return [...list].sort((a, b) => a.name.localeCompare(b.name));
    }
    if (sortBy === 'tracks') {
      return [...list].sort((a, b) => b.tracks.length - a.tracks.length);
    }
    return list;
  }, [playlists, q, sortBy]);

  const filteredAlbums = useMemo(() => {
    const list = savedAlbums.filter((a) =>
      q ? `${a.title} ${a.artist}`.toLowerCase().includes(q) : true
    );
    if (sortBy === 'az') {
      return [...list].sort((a, b) => a.title.localeCompare(b.title));
    }
    return list;
  }, [savedAlbums, q, sortBy]);

  const filteredArtists = useMemo(() => {
    const list = followedArtists.filter((a) =>
      q ? `${a.name} ${a.genre}`.toLowerCase().includes(q) : true
    );
    if (sortBy === 'az') {
      return [...list].sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [followedArtists, q, sortBy]);

  const filteredOfflineTracks = useMemo(() => {
    const list = offlineTracks.filter((t) =>
      q ? `${t.title} ${t.artist} ${t.album}`.toLowerCase().includes(q) : true
    );
    if (sortBy === 'az') {
      return [...list].sort((a, b) => a.title.localeCompare(b.title));
    }
    return list;
  }, [offlineTracks, q, sortBy]);

  const recentlyAddedTracks = useMemo(() => {
    return [...offlineTracks]
      .filter((t) => (q ? `${t.title} ${t.artist}`.toLowerCase().includes(q) : true))
      .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
      .slice(0, 6);
  }, [offlineTracks, q]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsImporting(true);
    try {
      await onImportLocalFiles(files);
      setFilter('offline');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-4 pb-44 text-white space-y-7 select-none animate-in fade-in duration-200">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,.mp3,.m4a,.aac,.flac,.wav,.ogg"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Page Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#A3A3A3] mb-1">Personal Collection</p>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Your Library
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="aura-btn-secondary inline-flex items-center gap-2 rounded-full px-4 min-h-[40px] text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{isImporting ? 'Importing...' : 'Import Audio'}</span>
          </button>
          <button
            type="button"
            onClick={onCreatePlaylist}
            className="aura-btn-primary inline-flex items-center gap-1.5 rounded-full px-4 min-h-[40px] text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Playlist</span>
          </button>
        </div>
      </div>

      {/* Category Filters */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
        {(
          [
            { id: 'all', label: 'All' },
            { id: 'playlists', label: `Playlists (${playlists.length})` },
            { id: 'albums', label: `Saved Albums (${savedAlbums.length})` },
            { id: 'artists', label: `Followed Artists (${followedArtists.length})` },
            { id: 'offline', label: `Offline Vault (${offlineTracks.length})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={`px-4 min-h-[36px] rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition cursor-pointer ${
              filter === tab.id
                ? 'bg-white text-black'
                : 'bg-[#191919] border border-[#303030] text-[#A3A3A3] hover:text-white hover:bg-[#222222]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search, Sort & Grid/List Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="w-full sm:max-w-xs">
          <SearchBar
            value={searchFilter}
            onChange={setSearchFilter}
            placeholder="Filter playlists, albums, tracks..."
            size="md"
          />
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2">
          <div className="inline-flex items-center gap-1 bg-[#191919] border border-[#303030] rounded-xl p-1">
            {(
              [
                { id: 'recent', label: 'Recent' },
                { id: 'az', label: 'A–Z' },
                { id: 'tracks', label: 'Most' },
              ] as const
            ).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSortBy(s.id)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  sortBy === s.id ? 'bg-[#303030] text-white' : 'text-[#737373] hover:text-white'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="inline-flex items-center bg-[#191919] border border-[#303030] rounded-xl p-1">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition cursor-pointer ${
                viewMode === 'list' ? 'bg-white text-black' : 'text-[#A3A3A3] hover:text-white'
              }`}
              aria-label="List view"
            >
              <ListIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition cursor-pointer ${
                viewMode === 'grid' ? 'bg-white text-black' : 'text-[#A3A3A3] hover:text-white'
              }`}
              aria-label="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Liked Songs & Quick Stats Strip when filter === 'all' */}
      {filter === 'all' && likedPlaylist && (
        <div
          onClick={() => onSelectPlaylist(likedPlaylist)}
          className="aura-card rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer group"
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#303030] to-[#111111] border border-white/20 flex items-center justify-center shrink-0">
              <Heart className="w-6 h-6 text-white fill-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-extrabold text-white truncate">Liked Songs</h2>
              <p className="text-xs text-[#A3A3A3] tabular-nums mt-0.5">
                {likedPlaylist.tracks.length} {likedPlaylist.tracks.length === 1 ? 'favourite track' : 'favourite tracks'}
              </p>
            </div>
          </div>
          <div className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center shrink-0 group-hover:scale-105 transition">
            <Play className="w-4 h-4 fill-current ml-0.5" />
          </div>
        </div>
      )}

      {/* Playlists Section */}
      {(filter === 'all' || filter === 'playlists') && (
        <section>
          <SectionHeader title="Your Playlists" subtitle="Personal collections and Liked Songs" />
          {filteredPlaylists.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[#191919] border border-[#303030] text-center">
              <p className="text-sm font-semibold text-white">No playlists match your filter</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
              {filteredPlaylists.map((playlist) => (
                <PlaylistCard
                  key={playlist.id}
                  playlist={playlist}
                  onClick={() => onSelectPlaylist(playlist)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPlaylists.map((playlist) => {
                const cover = playlist.coverUrl || playlist.tracks[0]?.coverUrl;
                return (
                  <div
                    key={playlist.id}
                    onClick={() => onSelectPlaylist(playlist)}
                    className="aura-card rounded-xl p-2.5 sm:p-3 flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#111111] border border-[#303030] flex items-center justify-center shrink-0">
                        {cover ? (
                          <img src={cover} alt={playlist.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                        ) : playlist.isLikedSongs ? (
                          <Heart className="w-5 h-5 text-white fill-white" />
                        ) : (
                          <Music className="w-5 h-5 text-[#737373]" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-white truncate">{playlist.name}</h3>
                        <p className="text-xs text-[#A3A3A3] tabular-nums mt-0.5">
                          Playlist · {playlist.tracks.length} {playlist.tracks.length === 1 ? 'song' : 'songs'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Saved Albums */}
      {(filter === 'all' || filter === 'albums') && (
        <section>
          <SectionHeader title="Saved Albums" subtitle="Full records & EPs bookmarked for quick access" />
          {filteredAlbums.length === 0 ? (
            <div className="p-6 rounded-2xl bg-[#191919] border border-[#303030] flex items-center gap-4 text-[#A3A3A3]">
              <Disc3 className="w-8 h-8 text-[#737373] shrink-0" />
              <div className="text-xs">
                <p className="text-white font-semibold text-sm">No saved albums yet</p>
                <p className="mt-0.5">Tap the bookmark button on any album card across Home or Explore.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
              {filteredAlbums.map((album) => (
                <AlbumCard
                  key={album.id}
                  title={album.title}
                  artist={album.artist}
                  coverUrl={album.coverUrl}
                  isSaved
                  onPlay={() => album.tracks[0] && onPlayTrack(album.tracks[0], undefined, album.tracks)}
                  onToggleSave={() => onToggleSaveAlbum(album)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Followed Artists */}
      {(filter === 'all' || filter === 'artists') && (
        <section>
          <SectionHeader title="Followed Artists" subtitle="Performers you follow across Aura Music" />
          {filteredArtists.length === 0 ? (
            <div className="p-6 rounded-2xl bg-[#191919] border border-[#303030] flex items-center gap-4 text-[#A3A3A3]">
              <UserCheck className="w-8 h-8 text-[#737373] shrink-0" />
              <div className="text-xs">
                <p className="text-white font-semibold text-sm">No followed artists yet</p>
                <p className="mt-0.5">Open any artist page and tap Follow to keep them here.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
              {filteredArtists.map((artist) => (
                <ArtistCard
                  key={artist.id}
                  artist={artist}
                  showGenre
                  onClick={() => onSelectArtist(artist.id)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Offline Vault & Recently Added */}
      {(filter === 'all' || filter === 'offline') && (
        <section>
          <SectionHeader
            title="Offline & Local Vault"
            subtitle="Downloaded audio & local device files playable without internet"
            actionLabel={offlineTracks.length > 0 ? `Play all (${offlineTracks.length})` : undefined}
            onAction={() => offlineTracks[0] && onPlayTrack(offlineTracks[0], undefined, offlineTracks)}
          />

          {filteredOfflineTracks.length === 0 ? (
            <div className="rounded-2xl bg-[#191919] border border-[#303030] p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <HardDriveDownload className="w-7 h-7 text-[#A3A3A3] shrink-0 mt-0.5" />
                <div className="text-xs text-[#A3A3A3]">
                  <p className="font-bold text-white text-sm">Offline &amp; Local Playback Vault</p>
                  <p className="mt-1">
                    Save streaming tracks offline or import MP3, M4A, FLAC, and WAV audio files from your device.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="aura-btn-primary px-4 py-2.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
              >
                Choose Audio Files
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredOfflineTracks.map((track) => {
                const isActive = currentTrack?.id === track.id;
                return (
                  <div
                    key={track.id}
                    onClick={() => onPlayTrack(track, undefined, offlineTracks)}
                    className={`group flex items-center justify-between gap-3 p-2.5 sm:px-3.5 rounded-xl border transition cursor-pointer ${
                      isActive ? 'bg-[#222222] border-white/30' : 'bg-[#191919] border-[#303030] hover:bg-[#222222]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-[#111111]">
                        <img
                          src={track.coverUrl || ECHO_COVERS.global}
                          alt={track.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        <div
                          className={`absolute inset-0 bg-black/55 flex items-center justify-center transition ${
                            isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          {isActive && isPlaying ? (
                            <Pause className="w-4 h-4 text-white fill-current" />
                          ) : (
                            <Play className="w-4 h-4 text-white fill-current ml-0.5" />
                          )}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-white truncate">{track.title}</p>
                        <p className="text-xs text-[#A3A3A3] truncate mt-0.5">
                          {track.artist} · {track.source === 'local' ? 'Local File' : 'Offline Saved'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveOfflineTrack(track.id);
                      }}
                      className="w-9 h-9 flex items-center justify-center rounded-full text-[#737373] hover:text-white hover:bg-[#303030] transition cursor-pointer"
                      aria-label="Remove offline track"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Recently Added & Recently Played */}
      {filter === 'all' && recentlyAddedTracks.length > 0 && (
        <section>
          <SectionHeader title="Recently Added" subtitle="Latest additions to your device vault" />
          <div className="space-y-2">
            {recentlyAddedTracks.map((track, idx) => (
              <SongRow
                key={`${track.id}-ra-${idx}`}
                track={track}
                isActive={currentTrack?.id === track.id}
                isPlaying={isPlaying}
                onPlay={() => onPlayTrack(track, undefined, recentlyAddedTracks)}
              />
            ))}
          </div>
        </section>
      )}

      {filter === 'all' && recentlyPlayed.length > 0 && (
        <section>
          <SectionHeader
            title="Recently Played"
            subtitle="Your recent listening timeline"
            rightSlot={<Clock className="w-4 h-4 text-[#737373]" />}
          />
          <div className="space-y-2">
            {recentlyPlayed.slice(0, 6).map((track, idx) => (
              <SongRow
                key={`${track.id}-rl-${idx}`}
                track={track}
                isActive={currentTrack?.id === track.id}
                isPlaying={isPlaying}
                onPlay={() => onPlayTrack(track, undefined, recentlyPlayed)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
