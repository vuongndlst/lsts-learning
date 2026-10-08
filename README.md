# LSTS Learning

Cổng chung cho C++ 8, Python 10, SQL 11 và Machine Learning Level 1 tại Đinh Thiện Lý: https://vuongndlst.github.io/lsts-learning/ .

## Học và tham gia lớp

- Link tham gia là cách chính: giáo viên mở lớp → Cài đặt → Sao chép link tham gia. Học sinh bấm link, đăng nhập/đăng ký rồi xác nhận vào đúng lớp. Link được giữ qua bước đăng nhập. Đổi link/đóng nhận học sinh giữ thành viên và bài làm. Mã lớp là phương án dự phòng.
- Mọi bài, chặng và checkpoint cuối đều mở, học bất kỳ lúc nào và theo thứ tự phù hợp. Không cần giao bài, lịch hoặc mã mở chặng. Giáo viên điều phối bằng lời nói. Mở điều hướng không tự ghi hoàn thành; các checkpoint/nhiệm vụ bắt buộc vẫn được kiểm tra.
- Mặc định vào đảo 3D cho bốn khóa. Thanh công cụ gọn, chuyển bài đọc/đảo, thu mục lục, toàn màn hình, sao chép link bài.
- Khách nhập họ tên trước khi vào bài; tiến độ/bài làm lưu trên trình duyệt. Có tải bản sao và chứng chỉ bài khi hoàn thành. Xóa bộ nhớ trình duyệt sẽ xóa tiến độ khách.
- Đăng nhập để lưu tiến độ/XP và nhận một chứng chỉ toàn khóa sau khi hoàn thành mọi bài. Tự học qua link trực tiếp hiện trong tiến độ của học sinh thuộc lớp cùng khóa. Chứng chỉ ghi nhận tự học, không thay điểm giáo viên xác nhận.
- MSHS đúng 7 chữ số, giữ số 0 đầu; email tự tạo MSHS@lsts.edu.vn. Hồ sơ sửa được. Mật khẩu ít nhất 8 ký tự, không xác nhận email. Phiên đăng nhập được giữ khi mở lại trình duyệt.

## Giáo viên và năm học

Dashboard chung, tạo lớp tự đặt tên/chọn khóa/năm/phiên bản, quản lý thành viên và tiến độ. Lớp web độc lập với lớp học thuật. Admin phân công giáo viên theo khóa/lớp; giáo viên cấp mật khẩu tạm cho học sinh thuộc lớp mình. Mật khẩu tạm buộc đổi trước khi sử dụng tài khoản. Lịch dạy tùy chọn để nhắc buổi, không khóa nội dung. Lưu trữ lớp cuối năm giữ bài làm; năm sau tạo lớp mới.

## Phát triển và học liệu

Node.js 24: npm ci, npm run dev, npm run build. GitHub Actions phát hành dist lên GitHub Pages. src/config.json chỉ có cấu hình công khai. Không đưa .env, khóa quản trị, mật khẩu, backup hoặc bài giải riêng vào repository.

Học liệu và notebook học sinh đóng gói riêng trong Supabase. Khách đọc bản công bố mới nhất; lớp giữ phiên bản giáo viên chọn. Cập nhật bằng phiên bản mới, không ghi đè bản đang có tiến độ. Chọn bản mới cho lớp cập nhật danh sách bài; bài làm cũ giữ lesson ID/phiên bản cũ. Bản nháp bài đang mở vẫn lưu được khi phát hành bản mới. Link tự học theo mã bài ổn định mở bản mới nhất.

Dữ liệu khách không tự gộp vào tài khoản. Tiến độ tài khoản tách theo lần học/lớp/phiên bản; XP khóa lấy giá trị cao nhất của mỗi mã bài để tránh cộng lặp. Chứng chỉ toàn khóa có mã duy nhất theo học sinh/khóa.

Migration đã áp dụng qua Management API; đối chiếu nhật ký trước db push. Quyền được kiểm tra ở máy chủ; Function cổng giữ verify_jwt:true. Xem [hướng dẫn giáo viên](HUONG_DAN_GIAO_VIEN.md).

## Triển khai song song

Cổng chạy song song với bốn website cũ. Các lớp C++ bài 1 và ML bài 5–6 chưa được tự chuyển danh sách/tiến độ. Đối chiếu và thí điểm một buổi trước khi chuyển; giữ đường dẫn và nguồn website cũ.
