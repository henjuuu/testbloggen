import { useState, useRef, useEffect } from 'react';
import { Upload, LogOut, LogIn, X, Trash2 } from 'lucide-react';
import { projectId, publicAnonKey } from './utils/supabase/info';

interface ImageData {
  id: string;
  url: string;
  date: Date;
  monthYear: string;
}

const API_URL = `https://${projectId}.supabase.co/functions/v1/make-server-16ace407`;

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [images, setImages] = useState<ImageData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const monthRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Load images from server on mount
  useEffect(() => {
    loadImages();
  }, []);

  const loadImages = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_URL}/images`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load images');
      }

      const data = await response.json();
      const imagesWithDates = data.images.map((img: any) => ({
        ...img,
        date: new Date(img.date)
      }));
      
      // Sort by date descending (newest first)
      imagesWithDates.sort((a: ImageData, b: ImageData) => b.date.getTime() - a.date.getTime());
      
      setImages(imagesWithDates);
    } catch (error) {
      console.error('Error loading images:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (username === 'henjuu' && password === 'solros45') {
      setIsAuthenticated(true);
      setLoginError('');
      setShowLoginModal(false);
      setUsername('');
      setPassword('');
    } else {
      setLoginError('Invalid username or password');
      setPassword('');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUsername('');
    setPassword('');
  };

  const openLoginModal = () => {
    setShowLoginModal(true);
    setLoginError('');
  };

  const closeLoginModal = () => {
    setShowLoginModal(false);
    setUsername('');
    setPassword('');
    setLoginError('');
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    setIsUploading(true);

    try {
      const fileArray = Array.from(files);
      const imagesToUpload = [];

      for (const file of fileArray) {
        if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
          // Convert image to base64
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve) => {
            reader.onloadend = () => {
              resolve(reader.result as string);
            };
            reader.readAsDataURL(file);
          });

          const base64 = await base64Promise;
          const date = new Date();
          const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          
          imagesToUpload.push({ base64, date: date.toISOString(), monthYear });
        }
      }

      if (imagesToUpload.length > 0) {
        const response = await fetch(`${API_URL}/images`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({ images: imagesToUpload })
        });

        if (!response.ok) {
          throw new Error('Failed to upload images');
        }

        // Reload images from server
        await loadImages();
      }
    } catch (error) {
      console.error('Error uploading images:', error);
      alert('Failed to upload images. Please try again.');
    } finally {
      setIsUploading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!confirm('Are you sure you want to delete this image?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/images/${imageId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete image');
      }

      // Reload images from server
      await loadImages();
    } catch (error) {
      console.error('Error deleting image:', error);
      alert('Failed to delete image. Please try again.');
    }
  };

  // Group images by month/year
  const groupedImages = images.reduce((acc, image) => {
    if (!acc[image.monthYear]) {
      acc[image.monthYear] = [];
    }
    acc[image.monthYear].push(image);
    return acc;
  }, {} as { [key: string]: ImageData[] });

  // Sort months in descending order (newest first)
  const sortedMonths = Object.keys(groupedImages).sort((a, b) => b.localeCompare(a));

  const scrollToMonth = (monthYear: string) => {
    const element = monthRefs.current[monthYear];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const getMonthName = (monthYear: string) => {
    const [year, month] = monthYear.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const getMonthShort = (monthYear: string) => {
    const [year, month] = monthYear.split('-');
    return `${month}/${year.slice(2)}`;
  };

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg shadow-2xl p-8 w-full max-w-md relative">
            <button
              onClick={closeLoginModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-2xl text-white mb-6">Login</h2>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-gray-300 mb-2 text-sm">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-gray-300 mb-2 text-sm">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>
              {loginError && (
                <div className="text-red-400 text-sm text-center">
                  {loginError}
                </div>
              )}
              <button
                type="submit"
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Login
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Fixed Header with Upload Button and Month Navigation */}
      <div className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800">
        <div className="p-4 flex flex-col gap-3">
          {/* Upload Section */}
          <div className="flex justify-center items-center">
            {isAuthenticated ? (
              <>
                <label
                  htmlFor="file-upload"
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      Upload JPG Images
                    </>
                  )}
                </label>
                <input
                  id="file-upload"
                  type="file"
                  accept="image/jpeg,image/jpg"
                  multiple
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="hidden"
                />
              </>
            ) : (
              <button
                onClick={openLoginModal}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <LogIn className="w-5 h-5" />
                Login
              </button>
            )}
            
            {images.length > 0 && (
              <div className="ml-4 flex items-center text-gray-400">
                {images.length} {images.length === 1 ? 'image' : 'images'}
              </div>
            )}
            
            {isAuthenticated && (
              <button
                onClick={handleLogout}
                className="ml-auto flex items-center gap-2 px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 hover:text-white transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            )}
          </div>

          {/* Month Navigation */}
          {sortedMonths.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2">
              {sortedMonths.map((monthYear) => (
                <button
                  key={monthYear}
                  onClick={() => scrollToMonth(monthYear)}
                  className="px-4 py-2 bg-gray-800 text-gray-300 rounded-md hover:bg-gray-700 hover:text-white transition-colors text-sm"
                  title={getMonthName(monthYear)}
                >
                  {getMonthShort(monthYear)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Image Gallery Grouped by Month */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
          <div className="text-gray-400 text-center">
            <p className="text-xl mb-2">Loading images...</p>
          </div>
        </div>
      ) : images.length > 0 ? (
        <div className="p-8">
          {sortedMonths.map((monthYear) => (
            <div
              key={monthYear}
              ref={(el) => (monthRefs.current[monthYear] = el)}
              className="mb-12"
            >
              {/* Month Header */}
              <div className="mb-6 pb-2 border-b border-gray-800">
                <h2 className="text-2xl text-white">{getMonthName(monthYear)}</h2>
                <p className="text-gray-500 text-sm">
                  {groupedImages[monthYear].length} {groupedImages[monthYear].length === 1 ? 'image' : 'images'}
                </p>
              </div>

              {/* Images for this month */}
              <div className="flex flex-col items-center gap-8">
                {groupedImages[monthYear].map((image, index) => (
                  <div key={index} className="w-full max-w-4xl relative group">
                    <div className="bg-gray-900 rounded-lg overflow-hidden shadow-2xl">
                      <img
                        src={image.url}
                        alt={`Uploaded on ${image.date.toLocaleDateString()}`}
                        className="w-full h-auto"
                      />
                      {isAuthenticated && (
                        <button
                          onClick={() => handleDeleteImage(image.id)}
                          className="absolute top-4 right-4 p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete image"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                    <div className="text-center text-gray-500 text-sm mt-2">
                      {image.date.toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
          <div className="text-gray-400 text-center">
            <p className="text-xl mb-2">No images uploaded yet</p>
            <p className="text-sm">Upload JPG images to get started</p>
          </div>
        </div>
      )}
    </div>
  );
}