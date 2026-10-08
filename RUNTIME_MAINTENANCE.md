# Bảo trì runtime của cổng

Nội dung học liệu nằm trong bundle/Supabase; chỉnh nội dung chỉ dùng build_content.cjs, ml_activities.py và phát hành phiên bản mới. Các thay đổi giao diện/runtime ở public/runtime là nguồn của cổng, được quản lý trong Git; không phải dữ liệu bài cần sinh lại mỗi lần cập nhật.

build_runtime.py và ml_quest.py là các script nhập engine lần đầu. Đã thêm guard bảo vệ: không cho chúng ghi đè runtime đã có marker portal-runtime.json. Không xóa marker để cập nhật nội dung. Những script update_flexible_*.py/finish_*.py/wire_certificates.py ghi lại thao tác một lần của đợt triển khai; không chạy lại làm pipeline định kỳ.

Khi cần nâng phiên bản engine gốc:

1. Tạo checkout thử, giữ bản đang dạy. Đọc diff engine nguồn và runtime cổng.
2. Ghép phần engine mới cần dùng vào runtime, giữ PortalCloud, chế độ học mở, query chang/cuoi, tên khách, chứng chỉ, focus.css và việc lưu phiên.
3. Chạy npm run build; thử bài đọc, đảo 3D, chặng bất kỳ, checkpoint cuối, bộ chạy thực hành, nháp mất mạng/xung đột và tiến độ cloud ở cả bốn khóa. Kiểm tra tiếp nhận qua link/đăng ký 8 ký tự trước khi phát hành.
4. Quét bí mật bằng scripts/publish.py refresh, rà diff checkout rồi phát hành. Dùng commit trước để quay lại giao diện khi cần; không rollback bằng cách xóa tiến độ hoặc gỡ bảng đang có dữ liệu.

Khi đổi Supabase, migration cộng thêm phải kiểm tra dry run trong transaction rollback rồi áp dụng; đối chiếu trạng thái thật trước db push vì các migration này đã chạy qua Management API. Mỗi bản phát hành ghi commit, báo cáo kiểm tra và backup mã hóa ở _Private; không đưa dữ liệu người dùng lên Git.
