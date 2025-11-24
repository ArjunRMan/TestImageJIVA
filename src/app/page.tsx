"use client";

import { useState, useRef, useMemo } from "react";
import ReactCrop, { Crop, PixelCrop } from "react-image-crop";

interface ApiResponse {
  status: string;
  filename: string;
  url: string;
}

type ConvertResponse = Record<string, unknown>;

interface ConvertTable {
  columns: string[];
  rows: string[][];
}

interface ConvertMetadata {
  entityType?: string;
  entityId?: string | number;
  class_id?: string | number;
  school_id?: string | number;
  academic_year?: string;
}

const extractConvertUrl = (response: ConvertResponse | null): string | null => {
  if (!response || typeof response !== "object") {
    return null;
  }

  const maybeUrl = (response as { url?: unknown }).url;
  return typeof maybeUrl === "string" ? maybeUrl : null;
};

const extractConvertTables = (
  response: ConvertResponse | null,
): ConvertTable[] => {
  if (
    !response ||
    typeof response !== "object" ||
    !("data" in response) ||
    typeof response.data !== "object" ||
    !response.data
  ) {
    return [];
  }

  const tables = (response.data as Record<string, unknown>)
    .extracted_tables;

  if (!Array.isArray(tables)) {
    return [];
  }

  return tables
    .map((table) => {
      if (
        typeof table !== "object" ||
        !table ||
        !Array.isArray((table as Record<string, unknown>).columns) ||
        !Array.isArray((table as Record<string, unknown>).rows)
      ) {
        return null;
      }
      return {
        columns: (table as Record<string, unknown>).columns as string[],
        rows: (table as Record<string, unknown>).rows as string[][],
      };
    })
    .filter((table): table is ConvertTable => !!table);
};

const extractConvertMetadata = (
  response: ConvertResponse | null,
): ConvertMetadata | null => {
  if (
    !response ||
    typeof response !== "object" ||
    !("data" in response) ||
    typeof response.data !== "object" ||
    !response.data
  ) {
    return null;
  }

  const metadata = (response.data as Record<string, unknown>).metadata;
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  return metadata as ConvertMetadata;
};

const buildDefaultCrop = (): Crop => ({
  unit: "%",
  width: 80,
  height: 80,
  x: 10,
  y: 10,
});

export default function Home() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiResponse, setApiResponse] = useState<ApiResponse | null>(null);
  const [convertResponse, setConvertResponse] = useState<ConvertResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const [crop, setCrop] = useState<Crop>(buildDefaultCrop());
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [grayscale, setGrayscale] = useState(0);
  const [contrast, setContrast] = useState(100);
  const [rotation, setRotation] = useState(0);
  const convertUrl = useMemo(
    () => extractConvertUrl(convertResponse),
    [convertResponse],
  );
  const convertTables = useMemo(
    () => extractConvertTables(convertResponse),
    [convertResponse],
  );
  const convertMetadata = useMemo(
    () => extractConvertMetadata(convertResponse),
    [convertResponse],
  );

  const convertApiUrl =
    process.env.NEXT_PUBLIC_CONVERT_API_URL ||
    "http://localhost:3000/api/v1/growth-card/convert-image";
  const convertApiToken = process.env.NEXT_PUBLIC_CONVERT_API_TOKEN || "";
  const convertEntityType =
    process.env.NEXT_PUBLIC_CONVERT_ENTITY_TYPE || "dkn_report";
  const convertEntityId =
    process.env.NEXT_PUBLIC_CONVERT_ENTITY_ID || "0";
  const convertClassId =
    process.env.NEXT_PUBLIC_CONVERT_CLASS_ID || "132";
  const convertSchoolId =
    process.env.NEXT_PUBLIC_CONVERT_SCHOOL_ID || "215";
  const convertAcademicYear =
    process.env.NEXT_PUBLIC_CONVERT_ACADEMIC_YEAR || "2025-2026";

  const appliedFilter = useMemo(() => {
    const grayValue = Math.max(0, Math.min(100, grayscale));
    return `grayscale(${grayValue}%) contrast(${contrast}%)`;
  }, [grayscale, contrast]);

  const resetEditorState = () => {
    setCrop(buildDefaultCrop());
    setCompletedCrop(null);
    setGrayscale(0);
    setContrast(100);
    setRotation(0);
  };

  const submitConvertImage = async (imageUrl: string) => {
    if (!convertApiUrl || !convertApiToken) {
      throw new Error("Convert API configuration missing. Check environment variables.");
    }
    const formData = new FormData();
    formData.append("image_url", imageUrl);
    formData.append("entityType", convertEntityType);
    formData.append("entityId", convertEntityId);
    formData.append("class_id", convertClassId);
    formData.append("school_id", convertSchoolId);
    formData.append("academic_year", convertAcademicYear);

    const convertResponse = await fetch(convertApiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${convertApiToken}`,
      },
      body: formData,
    });

    if (!convertResponse.ok) {
      const convertError = await convertResponse.json().catch(() => ({}));
      throw new Error(
        convertError?.message ||
          convertError?.detail ||
          `Convert API error: ${convertResponse.status} ${convertResponse.statusText}`,
      );
    }

    return convertResponse.json();
  };

  const processImageForUpload = async (): Promise<File> => {
    if (!selectedImage) {
      throw new Error("No image selected");
    }

    const img = imageRef.current;
    if (!img) {
      return selectedImage;
    }

    const scaleX = img.naturalWidth / img.width;
    const scaleY = img.naturalHeight / img.height;

    const activeCrop =
      completedCrop && completedCrop.width > 0 && completedCrop.height > 0
        ? completedCrop
        : {
            x: 0,
            y: 0,
            width: img.width,
            height: img.height,
          };

    const canvas = document.createElement("canvas");
    const normalizedRotation = ((rotation % 360) + 360) % 360;
    const isRotated90or270 = normalizedRotation === 90 || normalizedRotation === 270;
    
    const sourceWidth = activeCrop.width * scaleX;
    const sourceHeight = activeCrop.height * scaleY;
    
    // Swap dimensions if rotated 90 or 270 degrees
    canvas.width = isRotated90or270 ? sourceHeight : sourceWidth;
    canvas.height = isRotated90or270 ? sourceWidth : sourceHeight;
    
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Canvas is not supported in this browser");
    }

    // Apply filters
    ctx.filter = appliedFilter;
    
    // Apply rotation
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((normalizedRotation * Math.PI) / 180);
    
    // Draw the image centered
    ctx.drawImage(
      img,
      activeCrop.x * scaleX,
      activeCrop.y * scaleY,
      sourceWidth,
      sourceHeight,
      -sourceWidth / 2,
      -sourceHeight / 2,
      sourceWidth,
      sourceHeight,
    );
    
    ctx.restore();

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Failed to process image"));
            return;
          }
          resolve(
            new File([blob], selectedImage.name, {
              type: selectedImage.type || blob.type || "image/jpeg",
            }),
          );
        },
        selectedImage.type || "image/jpeg",
      );
    });
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setApiResponse(null);
      setConvertResponse(null);
      setError(null);
      resetEditorState();
    }
  };

  const handleSubmit = async () => {
    if (!selectedImage) return;

    setIsSubmitting(true);
    setError(null);
    setConvertResponse(null);

    try {
      const processedImage = await processImageForUpload();
      const formData = new FormData();
      formData.append("image", processedImage);

      const uploadApiUrl =
        process.env.NEXT_PUBLIC_PARSE_URL ||
        "https://parse.jivalearningsystem.com/api/upload-to-tmpfiles";

      const response = await fetch(uploadApiUrl, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.detail 
          ? Array.isArray(errorData.detail) 
            ? errorData.detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ')
            : typeof errorData.detail === 'string' 
              ? errorData.detail 
              : JSON.stringify(errorData.detail)
          : `API error: ${response.status} ${response.statusText}`;
        throw new Error(errorMessage);
      }

      const data: ApiResponse = await response.json();
      setApiResponse(data);

      if (data.url) {
        const convertResult = await submitConvertImage(data.url);
        setConvertResponse(convertResult);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process image");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSelectedImage(null);
    setPreviewUrl(null);
    setApiResponse(null);
    setConvertResponse(null);
    setError(null);
    resetEditorState();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-900 dark:text-white">
          Image Crop Preview
        </h1>

        {/* Upload Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 hover:border-blue-500 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
              id="image-upload"
            />
            <label
              htmlFor="image-upload"
              className="cursor-pointer flex flex-col items-center"
            >
              <svg
                className="w-16 h-16 text-gray-400 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <span className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                Click to upload an image
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                PNG, JPG, GIF up to 10MB
              </span>
            </label>
          </div>

          {selectedImage && (
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Selected: {selectedImage.name}
              </p>
            </div>
          )}
        </div>

        {/* Image Editor Section */}
        {previewUrl && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
              Image Editor
            </h2>
            
            {/* Image Preview with Crop */}
            <div className="flex items-center justify-center overflow-auto mb-6 bg-gray-100 dark:bg-gray-900 rounded-lg p-8 min-h-[400px]">
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                className="max-w-full"
              >
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-w-full max-h-[600px] object-contain"
                  style={{ 
                    filter: appliedFilter,
                    transform: `rotate(${rotation}deg)`,
                    transition: 'transform 0.3s ease'
                  }}
                  onLoad={(e) => {
                    imageRef.current = e.currentTarget;
                  }}
                />
              </ReactCrop>
            </div>

            {/* Controls */}
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 mb-4 grid gap-4 md:grid-cols-2">
              {/* Rotation Buttons */}
              <div className="md:col-span-2">
                <label className="text-sm font-semibold block mb-2 text-gray-900 dark:text-white">
                  Rotate Image
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setRotation((prev) => prev - 90)}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg shadow transition-colors flex items-center justify-center gap-2"
                    aria-label="Rotate left 90 degrees"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    Rotate Left (-90°)
                  </button>
                  <button
                    onClick={() => setRotation((prev) => prev + 90)}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg shadow transition-colors flex items-center justify-center gap-2"
                    aria-label="Rotate right 90 degrees"
                  >
                    Rotate Right (+90°)
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  </button>
                </div>
                {rotation !== 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Current rotation: {rotation}°
                  </p>
                )}
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-semibold flex justify-between text-gray-900 dark:text-white">
                  <span>Grayscale intensity</span>
                  <span>{grayscale}%</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={grayscale}
                  onChange={(e) => setGrayscale(Number(e.target.value))}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  0% keeps original colors, 100% converts fully to grayscale.
                </p>
              </div>
              <div>
                <label className="text-sm font-semibold flex justify-between text-gray-900 dark:text-white">
                  <span>Contrast</span>
                  <span>{contrast}%</span>
                </label>
                <input
                  type="range"
                  min={50}
                  max={150}
                  value={contrast}
                  onChange={(e) => setContrast(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 md:flex-row md:justify-center">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-8 rounded-lg shadow-lg transition-colors flex items-center gap-2 justify-center"
              >
                {isSubmitting ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  "Submit"
                )}
              </button>
              <button
                onClick={handleReset}
                className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-8 rounded-lg shadow-lg transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        )}

        {/* API Response Section */}
        {apiResponse && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
              Response
            </h2>
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <p className="text-green-800 dark:text-green-200 font-semibold">
                  Status: {apiResponse.status}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Filename:
                </p>
                <p className="text-gray-900 dark:text-white font-mono">
                  {apiResponse.filename}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  URL:
                </p>
                <a
                  href={apiResponse.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                >
                  {apiResponse.url}
                </a>
              </div>
              {apiResponse.url && (
                <div className="mt-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Preview:
                  </p>
                  <img
                    src={apiResponse.url}
                    alt="Processed image"
                    className="max-w-full rounded-lg border border-gray-200 dark:border-gray-700"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Convert API Response */}
        {convertResponse && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
              Growth Card Convert Result
            </h2>
            {convertMetadata && (
              <div className="grid gap-2 md:grid-cols-2 text-sm text-gray-700 dark:text-gray-300 mb-4">
                <p>
                  <span className="font-semibold">Entity Type:</span>{" "}
                  {convertMetadata.entityType}
                </p>
                <p>
                  <span className="font-semibold">Entity ID:</span>{" "}
                  {convertMetadata.entityId}
                </p>
                <p>
                  <span className="font-semibold">Class ID:</span>{" "}
                  {convertMetadata.class_id}
                </p>
                <p>
                  <span className="font-semibold">School ID:</span>{" "}
                  {convertMetadata.school_id}
                </p>
                <p className="md:col-span-2">
                  <span className="font-semibold">Academic Year:</span>{" "}
                  {convertMetadata.academic_year}
                </p>
              </div>
            )}
            {convertUrl && (
              <div className="mb-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Converted Image URL:
                </p>
                <a
                  href={convertUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                >
                  {convertUrl}
                </a>
                <img
                  src={convertUrl}
                  alt="Converted result"
                  className="mt-3 max-w-full rounded-lg border border-gray-200 dark:border-gray-700"
                />
              </div>
            )}
            {convertTables.length > 0 && (
              <div className="space-y-6">
                {convertTables.map((table, idx) => (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Table {idx + 1}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {table.columns.length - 1} cols × {table.rows.length} rows
                      </p>
                    </div>
                    <div className="overflow-auto">
                      <table className="min-w-[750px] border border-gray-200 dark:border-gray-700 text-xs md:text-sm">
                        <thead>
                          <tr>
                            {table.columns.map((col, colIdx) => (
                              <th
                                key={`${idx}-col-${colIdx}`}
                                className="border border-gray-200 dark:border-gray-700 px-2 py-1 font-semibold text-gray-800 dark:text-gray-100 text-center"
                              >
                                {col || "Day"}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {table.rows.map((row, rowIdx) => (
                            <tr key={`${idx}-row-${rowIdx}`}>
                              {row.map((cell, cellIdx) => (
                                <td
                                  key={`${idx}-cell-${rowIdx}-${cellIdx}`}
                                  className={`border border-gray-200 dark:border-gray-700 px-2 py-1 text-center font-mono ${
                                    cell === "1"
                                      ? "bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-200"
                                      : cell === "0"
                                        ? "bg-yellow-50 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200"
                                        : "bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200"
                                  }`}
                                >
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Error Section */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-800 dark:text-red-200 font-semibold">
              Error: {error}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

