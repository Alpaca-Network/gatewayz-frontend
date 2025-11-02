import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const modelId = searchParams.get('modelId');

  if (!modelId) {
    return NextResponse.json({ error: 'modelId is required' }, { status: 400 });
  }

  try {
    const response = await fetch(
      `https://www.modelz.io/api/huggingface?modelId=${encodeURIComponent(modelId)}`
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch model data' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.log('Error fetching model logo:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
