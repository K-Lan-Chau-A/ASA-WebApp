import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-6 p-4">
      {/* Tiêu đề Tailwind */}
      <h1 className="text-4xl font-bold text-primary">
        🚀 Tailwind + shadcn/ui Test
      </h1>

      {/* Nút shadcn */}
      <Button className="bg-primary text-white hover:bg-primary/90">
        Nút Primary
      </Button>

      <Button className="bg-secondary text-white hover:bg-secondary/90">
        Nút Secondary
      </Button>

      {/* Card shadcn */}
      <Card className="w-80">
        <CardHeader>
          <CardTitle className="text-primary">Thẻ kiểm tra</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            Màu primary là xanh lá #009DA5 và màu secondary là xanh dương #0D6CE8
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
