import { Video } from '@/types/video';
import { usePlaylist } from '@/contexts/PlaylistContext';
import { Heart, Play, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface VideoListProps {
  videos: Video[];
  className?: string;
}

interface SortableVideoItemProps {
  video: Video;
  index: number;
  isCurrentVideo: boolean;
  isVideoFavorite: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
}

function SortableVideoItem({ 
  video, 
  index, 
  isCurrentVideo, 
  isVideoFavorite, 
  onSelect, 
  onToggleFavorite 
}: SortableVideoItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: video.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex w-full items-center gap-2 rounded-lg p-3 transition-all',
        isCurrentVideo 
          ? 'bg-primary text-primary-foreground' 
          : 'hover:bg-secondary',
        isDragging && 'shadow-lg ring-2 ring-primary'
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className={cn(
          'cursor-grab touch-none p-1 rounded opacity-50 hover:opacity-100 transition-opacity',
          isCurrentVideo ? 'hover:bg-primary-foreground/20' : 'hover:bg-secondary'
        )}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Clickable content */}
      <button
        onClick={onSelect}
        className="flex flex-1 items-center gap-3 text-left min-w-0"
      >
        {/* Index / Playing indicator */}
        <div className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm font-medium',
          isCurrentVideo 
            ? 'bg-primary-foreground/20' 
            : 'bg-secondary text-muted-foreground'
        )}>
          {isCurrentVideo ? (
            <Play className="h-4 w-4 fill-current" />
          ) : (
            index + 1
          )}
        </div>

        {/* Video info */}
        <div className="min-w-0 flex-1">
          <p className={cn(
            'truncate font-medium',
            isCurrentVideo ? 'text-primary-foreground' : 'text-foreground'
          )}>
            {video.title}
          </p>
          <p className={cn(
            'text-xs',
            isCurrentVideo ? 'text-primary-foreground/70' : 'text-muted-foreground'
          )}>
            Page {video.page} • {video.platform}
          </p>
        </div>
      </button>

      {/* Favorite button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        className={cn(
          'h-8 w-8 shrink-0 opacity-0 transition-opacity group-hover:opacity-100',
          isVideoFavorite && 'opacity-100 text-favorite',
          isCurrentVideo && 'hover:bg-primary-foreground/20'
        )}
      >
        <Heart className={cn('h-4 w-4', isVideoFavorite && 'fill-current')} />
      </Button>
    </div>
  );
}

export function VideoList({ videos, className }: VideoListProps) {
  const { 
    toggleFavorite, 
    isFavorite, 
    playbackState, 
    setCurrentVideoIndex,
    currentPlaylist,
    reorderVideos,
  } = usePlaylist();

  const currentVideoId = currentPlaylist?.videos[playbackState.currentVideoIndex]?.id;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = videos.findIndex((v) => v.id === active.id);
      const newIndex = videos.findIndex((v) => v.id === over.id);
      reorderVideos(oldIndex, newIndex);
    }
  };

  return (
    <ScrollArea className={cn('h-full', className)}>
      <div className="space-y-1 p-2">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={videos.map(v => v.id)}
            strategy={verticalListSortingStrategy}
          >
            {videos.map((video, index) => (
              <SortableVideoItem
                key={video.id}
                video={video}
                index={index}
                isCurrentVideo={video.id === currentVideoId}
                isVideoFavorite={isFavorite(video.id)}
                onSelect={() => setCurrentVideoIndex(index)}
                onToggleFavorite={() => toggleFavorite(video.id)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </ScrollArea>
  );
}