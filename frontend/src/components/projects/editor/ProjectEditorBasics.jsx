/**
 * ProjectEditorBasics — Step 1 form section.
 *
 * Renders the always-visible basics card (name, ecosystem, description,
 * hero image + gallery, GitHub URL, category, live URL, optional
 * "other" detail, ecosystem-specific submission requirements).
 */

import { PhotoIcon } from "@heroicons/react/24/outline";
import { Card } from "@/components/common/Card";
import { Input, Textarea, Select } from "@/components/common/Input";
import { LoadingSpinner } from "@/components/common/LoadingStates";

export default function ProjectEditorBasics({
  form,
  setField,
  ecosystemOptions,
  categoryOptions,
  ecosystemConfig,
  imageUrl,
  setImageUrl,
  uploadingImage,
  imageError,
  onHeroUpload,
  galleryMedia,
  onGalleryUpload,
  onAddVideoUrl,
  onRemoveMedia,
  fetchingGithub,
}) {
  return (
    <Card className="p-6 space-y-5">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Basics</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Project name"
          value={form.name}
          onChange={(e) => setField("name", e.target.value)}
          required
        />
        <Select
          label="Chain"
          value={form.ecosystem}
          onChange={(e) => setField("ecosystem", e.target.value)}
          required
        >
          {ecosystemOptions.map((eco) => (
            <option key={eco.id} value={eco.id}>{eco.shortName}</option>
          ))}
        </Select>
      </div>

      <Textarea
        label="Description"
        value={form.description}
        onChange={(e) => setField("description", e.target.value)}
        placeholder="What does it do, who is it for, and what’s onchain?"
        rows={4}
        required
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Project image</label>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          Shown on project cards and backer feeds. Auto-resized to 1200×630. Max 2MB.
        </p>
        <div className="flex items-start gap-4 flex-wrap">
          {imageUrl ? (
            <div className="relative w-40 h-[84px] rounded-lg overflow-hidden border border-gray-200 bg-gray-50 flex-shrink-0">
              <img src={imageUrl} alt="Project preview" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setImageUrl("")}
                className="absolute top-1 right-1 bg-white/90 rounded-full p-0.5 hover:bg-red-50 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:text-red-400 text-xs"
                title="Remove image"
              >
                ✕
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-40 h-[84px] rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 cursor-pointer hover:border-blue-400 transition-colors flex-shrink-0">
              <PhotoIcon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
              <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">Upload image</span>
              <input type="file" accept="image/*" onChange={onHeroUpload} className="hidden" />
            </label>
          )}
          {uploadingImage && <LoadingSpinner size="sm" />}
          {imageError && <span className="text-xs text-red-600 dark:text-red-400">{imageError}</span>}
        </div>
      </div>

      <div className="border-t border-gray-100 pt-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Media gallery</label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Additional images and videos. First image is the hero, rest form a gallery.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onAddVideoUrl}
              className="text-xs font-medium text-gray-600 hover:text-gray-900 dark:text-gray-100 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
            >
              + Add video URL
            </button>
            <label className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-lg border border-blue-200 hover:border-blue-300 cursor-pointer transition-colors">
              + Add images
              <input type="file" accept="image/*" multiple onChange={onGalleryUpload} className="hidden" />
            </label>
          </div>
        </div>

        {galleryMedia.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {galleryMedia.map((item, idx) => (
              <div key={idx} className="relative group rounded-lg overflow-hidden border border-gray-200 bg-gray-50 aspect-video">
                {item.type === "video" ? (
                  <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white">
                    <svg className="w-8 h-8 opacity-60" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                ) : (
                  <img src={item.url} alt={item.caption || `Gallery ${idx + 1}`} className="w-full h-full object-cover" />
                )}
                <button
                  type="button"
                  onClick={() => onRemoveMedia(idx)}
                  className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                >
                  ✕
                </button>
                {item.caption && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                    <p className="text-[10px] text-white truncate">{item.caption}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {galleryMedia.length === 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4 border border-dashed border-gray-200 rounded-lg">
            No gallery items yet. Add images or video URLs to showcase your project.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="GitHub repository"
          value={form.githubUrl}
          onChange={(e) => setField("githubUrl", e.target.value)}
          placeholder="https://github.com/org/repo"
          required
        />
        <div className="text-xs text-gray-600 dark:text-gray-400">
          {fetchingGithub ? "⏳ Auto-populating from GitHub..." : "Paste a GitHub URL to auto-fill project details."}
        </div>

        <Select
          label="Category"
          value={form.category}
          onChange={(e) => setField("category", e.target.value)}
          required
        >
          <option value="" disabled>Select a category</option>
          {categoryOptions.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>

        <Input
          label="Live app link"
          value={form.liveUrl}
          onChange={(e) => setField("liveUrl", e.target.value)}
          placeholder="https://yourapp.com — where users can try it"
        />
      </div>

      {form.category === "other" && (
        <Input
          label="What kind of project is this?"
          value={form.otherCategoryDetail}
          onChange={(e) => setField("otherCategoryDetail", e.target.value)}
          placeholder="e.g. AI tooling, data indexer, developer SDK..."
          required
        />
      )}

      {Array.isArray(ecosystemConfig?.submissionRequirements) && ecosystemConfig.submissionRequirements.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="font-medium text-gray-900 dark:text-gray-100 mb-2">
            {ecosystemConfig.shortName} submission checklist
          </div>
          <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1 list-disc pl-5">
            {ecosystemConfig.submissionRequirements.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
