import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { Badge } from "../components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/Tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/Select";
import { Textarea } from "../components/ui/Textarea";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Briefcase,
  Shield,
  Edit2,
  Save,
  Camera,
} from "lucide-react";

export default function UserProfile() {
  const [isEditing, setIsEditing] = useState(false);
  const [userData, setUserData] = useState({
    name: "John Doe",
    email: "john.doe@example.com",
    phone: "+1 (555) 123-4567",
    location: "San Francisco, CA",
    bio: "Software developer passionate about blockchain and web3 technologies.",
    website: "https://johndoe.dev",
    github: "johndoe",
    twitter: "johndoe",
    linkedin: "johndoe",
    joinDate: "January 2024",
    status: "active",
    walletAddress: "0x1234...5678",
    trustScore: 95,
  });

  const handleSave = () => {
    setIsEditing(false);
    // Here you would typically save to backend
    console.log("Saving user data:", userData);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleInputChange = (field: string, value: string) => {
    setUserData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Profile Card */}
        <div className="lg:w-1/3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center space-y-4">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center">
                    <User className="w-12 h-12 text-gray-400" />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="absolute bottom-0 right-0 rounded-full w-8 h-8 p-0"
                  >
                    <Camera className="w-4 h-4" />
                  </Button>
                </div>

                <div className="text-center">
                  <h2 className="text-2xl font-bold">{userData.name}</h2>
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <Badge
                      variant={
                        userData.status === "active" ? "default" : "secondary"
                      }
                    >
                      {userData.status}
                    </Badge>
                    <Badge variant="outline">
                      Trust Score: {userData.trustScore}
                    </Badge>
                  </div>
                </div>

                <div className="w-full space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-500" />
                    <span>{userData.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-500" />
                    <span>{userData.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    <span>{userData.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span>Joined {userData.joinDate}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-gray-500" />
                    <span className="font-mono text-xs">
                      {userData.walletAddress}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 w-full">
                  {isEditing ? (
                    <Button onClick={handleSave} className="flex-1">
                      <Save className="w-4 h-4 mr-2" />
                      Save
                    </Button>
                  ) : (
                    <Button onClick={handleEdit} className="flex-1">
                      <Edit2 className="w-4 h-4 mr-2" />
                      Edit Profile
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:w-2/3 space-y-6">
          <Tabs defaultValue="about" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="about">About</TabsTrigger>
              <TabsTrigger value="experience">Experience</TabsTrigger>
              <TabsTrigger value="social">Social</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="about" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>About Me</CardTitle>
                  <CardDescription>Tell us about yourself</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isEditing ? (
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="bio">Bio</Label>
                        <Textarea
                          id="bio"
                          value={userData.bio}
                          onChange={(e) =>
                            handleInputChange("bio", e.target.value)
                          }
                          placeholder="Tell us about yourself..."
                          className="min-h-[100px]"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="website">Website</Label>
                          <Input
                            id="website"
                            value={userData.website}
                            onChange={(e) =>
                              handleInputChange("website", e.target.value)
                            }
                            placeholder="https://yourwebsite.com"
                          />
                        </div>
                        <div>
                          <Label htmlFor="location">Location</Label>
                          <Input
                            id="location"
                            value={userData.location}
                            onChange={(e) =>
                              handleInputChange("location", e.target.value)
                            }
                            placeholder="City, Country"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-gray-700 leading-relaxed">
                        {userData.bio}
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium">Website</Label>
                          <p className="text-blue-600 hover:underline cursor-pointer">
                            {userData.website}
                          </p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium">
                            Location
                          </Label>
                          <p>{userData.location}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="experience" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Work Experience</CardTitle>
                  <CardDescription>
                    Your professional background
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-6">
                    <div className="border-l-2 border-gray-200 pl-4">
                      <div className="flex items-start gap-3 mb-2">
                        <Briefcase className="w-5 h-5 text-blue-600 mt-1" />
                        <div>
                          <h4 className="font-semibold">
                            Senior Full Stack Developer
                          </h4>
                          <p className="text-sm text-gray-600">
                            Tech Company Inc.
                          </p>
                          <p className="text-sm text-gray-500">
                            2022 - Present
                          </p>
                        </div>
                      </div>
                      <p className="ml-8 text-gray-700">
                        Leading development of web3 applications and blockchain
                        integrations.
                      </p>
                    </div>

                    <div className="border-l-2 border-gray-200 pl-4">
                      <div className="flex items-start gap-3 mb-2">
                        <Briefcase className="w-5 h-5 text-green-600 mt-1" />
                        <div>
                          <h4 className="font-semibold">Frontend Developer</h4>
                          <p className="text-sm text-gray-600">StartupXYZ</p>
                          <p className="text-sm text-gray-500">2020 - 2022</p>
                        </div>
                      </div>
                      <p className="ml-8 text-gray-700">
                        Built responsive web applications using React and
                        TypeScript.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="social" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Social Profiles</CardTitle>
                  <CardDescription>
                    Connect your social accounts
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="github">GitHub</Label>
                      <Input
                        id="github"
                        value={userData.github}
                        onChange={(e) =>
                          handleInputChange("github", e.target.value)
                        }
                        placeholder="username"
                      />
                    </div>
                    <div>
                      <Label htmlFor="twitter">Twitter</Label>
                      <Input
                        id="twitter"
                        value={userData.twitter}
                        onChange={(e) =>
                          handleInputChange("twitter", e.target.value)
                        }
                        placeholder="username"
                      />
                    </div>
                    <div>
                      <Label htmlFor="linkedin">LinkedIn</Label>
                      <Input
                        id="linkedin"
                        value={userData.linkedin}
                        onChange={(e) =>
                          handleInputChange("linkedin", e.target.value)
                        }
                        placeholder="username"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Settings</CardTitle>
                  <CardDescription>
                    Manage your account settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label>Account Status</Label>
                    <Select value={userData.status}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Email Notifications</Label>
                    <Select defaultValue="all">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All notifications</SelectItem>
                        <SelectItem value="important">
                          Important only
                        </SelectItem>
                        <SelectItem value="none">None</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Privacy Settings</Label>
                    <div className="space-y-2">
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" defaultChecked />
                        <span>Show profile to public</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" defaultChecked />
                        <span>Allow direct messages</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" />
                        <span>Show online status</span>
                      </label>
                    </div>
                  </div>

                  <div className="pt-4 space-x-2">
                    <Button variant="outline">Cancel</Button>
                    <Button>Save Changes</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
